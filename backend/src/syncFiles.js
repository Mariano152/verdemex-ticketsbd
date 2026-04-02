#!/usr/bin/env node
/**
 * Script de sincronización de rutas de archivos
 * Corrige las rutas en la BD para archivos que existen en disco pero con ruta incorrecta
 */

const path = require('path');
const fs = require('fs');
const db = require('./database');

const outDir = path.join(__dirname, '..', 'output');

async function syncFiles() {
  try {
    console.log('🔄 Iniciando sincronización de archivos...\n');
    
    const allFiles = await db.pool.query('SELECT id, name, path, company_id FROM files ORDER BY id');
    const dbFiles = allFiles.rows;
    
    if (dbFiles.length === 0) {
      console.log('ℹ️  No hay archivos en la BD');
      process.exit(0);
    }
    
    const outputFiles = fs.readdirSync(outDir)
      .filter(f => !fs.statSync(path.join(outDir, f)).isDirectory());
    
    console.log(`📊 Estadísticas:`);
    console.log(`  - Archivos en BD: ${dbFiles.length}`);
    console.log(`  - Archivos en disco: ${outputFiles.length}`);
    console.log(`  - Directorio: ${outDir}\n`);
    
    let corrected = 0;
    let notFound = 0;
    let alreadyOk = 0;
    const results = [];
    
    // Track which files have been assigned to avoid duplicates
    const assignedFiles = new Set();
    
    for (const dbFile of dbFiles) {
      const fileExists = fs.existsSync(dbFile.path);
      
      if (fileExists) {
        alreadyOk++;
        assignedFiles.add(dbFile.path);
        results.push({ id: dbFile.id, name: dbFile.name, status: '✅ OK' });
        continue;
      }
      
      // Buscar el archivo
      const fileName = dbFile.name;
      const ext = path.extname(fileName);
      const baseNameWithoutExt = path.basename(fileName, ext);
      
      let foundFile = null;
      
      // Estrategia 1: Coincidencia exacta del nombre
      foundFile = outputFiles.find(f => f === fileName);
      
      // Estrategia 2: Patrón del nombre base + extensión (pero no si ya fue asignado)
      if (!foundFile) {
        foundFile = outputFiles.find(f => {
          const candidate = path.join(outDir, f);
          return f.endsWith(ext) && 
                 f.startsWith(baseNameWithoutExt) && 
                 !assignedFiles.has(candidate);
        });
      }
      
      // No usar estrategia 3 (solo extensión) ya que es muy permisiva
      
      if (foundFile) {
        const newPath = path.join(outDir, foundFile);
        await db.pool.query(
          'UPDATE files SET path = $1 WHERE id = $2',
          [newPath, dbFile.id]
        );
        assignedFiles.add(newPath);
        corrected++;
        results.push({ 
          id: dbFile.id, 
          name: dbFile.name, 
          status: `🔧 Corregida → ${foundFile}` 
        });
        console.log(`  🔧 ID ${String(dbFile.id).padStart(3)} | ${dbFile.name}`);
        console.log(`     → ${foundFile}`);
      } else {
        notFound++;
        results.push({ 
          id: dbFile.id, 
          name: dbFile.name, 
          status: '❌ No encontrado' 
        });
        console.log(`  ❌ ID ${String(dbFile.id).padStart(3)} | ${dbFile.name} (NO ENCONTRADO)`);
      }
    }
    
    console.log('\n📊 Resultado de sincronización:');
    console.log(`  ✅ OK: ${alreadyOk}`);
    console.log(`  🔧 Corregidos: ${corrected}`);
    console.log(`  ❌ No encontrados: ${notFound}`);
    console.log(`  📈 Total revisados: ${dbFiles.length}\n`);
    
    if (notFound > 0) {
      console.log('⚠️  Archivos no encontrados:');
      results
        .filter(r => r.status === '❌ No encontrado')
        .forEach(r => console.log(`   - ${r.name}`));
      console.log('\n💡 Considera eliminar estos registros de la BD si los archivos se perdieron\n');
    }
    
    console.log('✅ Sincronización completada');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

syncFiles();
