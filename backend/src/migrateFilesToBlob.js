#!/usr/bin/env node
/**
 * Script para migrar archivos existentes (guardados en path) a BLOB
 * 
 * Uso: node src/migrateFilesToBlob.js
 * 
 * Esto:
 * 1. Lee todos los archivos con path pero sin file_data
 * 2. Intenta encontrar los archivos en backend/output
 * 3. Los convierte a BLOB y actualiza la BD
 * 4. Reporta cuáles se migraron y cuáles no se encontraron
 */

const fs = require('fs');
const path = require('path');
const db = require('./database');

const outDir = path.join(__dirname, '..', 'output');

async function migrateFilesToBlob() {
  try {
    console.log('\n\n🔄 =======================================');
    console.log('   MIGRACIÓN: PATH → BLOB');
    console.log('======================================= 🔄\n');

    // ============================================
    // PARTE 1: MIGRAR TABLA FILES
    // ============================================
    console.log('📋 TABLA: files');
    console.log('Buscando archivos sin file_data en BD...');
    const filesResult = await db.pool.query(
      'SELECT id, name, type, path FROM files WHERE file_data IS NULL AND path IS NOT NULL AND deleted_at IS NULL'
    );
    
    const filesToMigrate = filesResult.rows;
    console.log(`✅ Encontrados ${filesToMigrate.length} archivo(s) para migrar\n`);

    let filesSuccess = 0;
    let filesFail = 0;
    const fileResults = [];

    // Migrar archivos
    for (const file of filesToMigrate) {
      const { id, name, type, path: filePath } = file;
      
      console.log(`⏳ ${name} (ID: ${id})`);
      
      try {
        let fileBuffer = null;
        let found = false;

        if (fs.existsSync(filePath)) {
          fileBuffer = fs.readFileSync(filePath);
          found = true;
          console.log(`  ✅ Encontrado en ruta original`);
        } else {
          const fileName = path.basename(filePath);
          const outputPath = path.join(outDir, fileName);
          
          if (fs.existsSync(outputPath)) {
            fileBuffer = fs.readFileSync(outputPath);
            found = true;
            console.log(`  ✅ Encontrado en output/`);
          } else {
            console.log(`  ⚠️  Archivo no encontrado`);
          }
        }

        if (found && fileBuffer) {
          await db.pool.query(
            'UPDATE files SET file_data = $1 WHERE id = $2',
            [fileBuffer, id]
          );
          
          console.log(`  ✅ Migrado a BLOB (${(fileBuffer.length / 1024).toFixed(2)} KB)`);
          fileResults.push({ name, status: 'success', size: fileBuffer.length });
          filesSuccess++;
        } else {
          console.log(`  ❌ No se pudo leer`);
          fileResults.push({ name, status: 'not_found' });
          filesFail++;
        }
      } catch (err) {
        console.log(`  ❌ Error: ${err.message}`);
        fileResults.push({ name, status: 'error', error: err.message });
        filesFail++;
      }
    }

    // ============================================
    // PARTE 2: MIGRAR TABLA PHOTOS
    // ============================================
    console.log('\n\n📋 TABLA: photos');
    console.log('Buscando fotos sin photo_data en BD...');
    
    const photosResult = await db.pool.query(
      'SELECT id, filename, path FROM photos WHERE photo_data IS NULL AND path IS NOT NULL AND is_deleted = false'
    );
    
    const photosToMigrate = photosResult.rows;
    console.log(`✅ Encontradas ${photosToMigrate.length} foto(s) para migrar\n`);

    let photosSuccess = 0;
    let photosFail = 0;
    const photoResults = [];

    // Migrar fotos
    for (const photo of photosToMigrate) {
      const { id, filename, path: photoPath } = photo;
      
      console.log(`⏳ ${filename} (ID: ${id})`);
      
      try {
        let photoBuffer = null;
        let found = false;

        if (fs.existsSync(photoPath)) {
          photoBuffer = fs.readFileSync(photoPath);
          found = true;
          console.log(`  ✅ Encontrada en ruta original`);
        } else {
          // Intentar en output/photos
          const photoDirPath = path.join(outDir, 'photos', path.basename(photoPath));
          
          if (fs.existsSync(photoDirPath)) {
            photoBuffer = fs.readFileSync(photoDirPath);
            found = true;
            console.log(`  ✅ Encontrada en output/photos`);
          } else {
            console.log(`  ⚠️  Foto no encontrada`);
          }
        }

        if (found && photoBuffer) {
          await db.pool.query(
            'UPDATE photos SET photo_data = $1 WHERE id = $2',
            [photoBuffer, id]
          );
          
          console.log(`  ✅ Migrada a BLOB (${(photoBuffer.length / 1024).toFixed(2)} KB)`);
          photoResults.push({ name: filename, status: 'success', size: photoBuffer.length });
          photosSuccess++;
        } else {
          console.log(`  ❌ No se pudo leer`);
          photoResults.push({ name: filename, status: 'not_found' });
          photosFail++;
        }
      } catch (err) {
        console.log(`  ❌ Error: ${err.message}`);
        photoResults.push({ name: filename, status: 'error', error: err.message });
        photosFail++;
      }
    }

    // ============================================
    // RESUMEN
    // ============================================
    console.log('\n\n=======================================');
    console.log('📊 RESUMEN DE MIGRACIÓN\n');
    
    console.log('📁 ARCHIVOS (files):');
    console.log(`   ✅ Exitosos: ${filesSuccess}`);
    console.log(`   ❌ Fallidos: ${filesFail}`);
    console.log(`   📦 Total: ${filesToMigrate.length}`);
    
    console.log('\n📷 FOTOS (photos):');
    console.log(`   ✅ Exitosas: ${photosSuccess}`);
    console.log(`   ❌ Fallidas: ${photosFail}`);
    console.log(`   📦 Total: ${photosToMigrate.length}`);
    
    const totalSuccess = filesSuccess + photosSuccess;
    const totalFail = filesFail + photosFail;
    console.log(`\n🎯 TOTAL:`);
    console.log(`   ✅ ${totalSuccess} total migrados`);
    console.log(`   ❌ ${totalFail} total fallidos\n`);

    if (totalFail > 0) {
      console.log('⚠️  Nota: Los archivos/fotos no encontrados pueden haber sido eliminados.');
      console.log('   Puedes descartar estas filas manualmente de la BD si es necesario.\n');
    }

    console.log('=======================================');
    console.log('✨ Migración completada!\n');

    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Error fatal: ${err.message}\n`);
    console.error(err);
    process.exit(1);
  }
}

// Ejecutar
if (require.main === module) {
  migrateFilesToBlob();
}

module.exports = { migrateFilesToBlob };
