const path = require('path');
const fs = require('fs');
const db = require('./database');

const outDir = path.join(__dirname, '..', 'output');

async function registerMissingFiles() {
  try {
    console.log('📝 Registrando archivos del disco en la BD...\n');
    
    // Obtener archivos en BD
    const dbFiles = await db.pool.query('SELECT name FROM files');
    const dbFileNames = new Set(dbFiles.rows.map(f => f.name));
    
    // Obtener archivos en disco
    const outputFiles = fs.readdirSync(outDir)
      .filter(f => !fs.statSync(path.join(outDir, f)).isDirectory())
      .filter(f => /\.(xlsx|txt|zip)$/.test(f));
    
    console.log(`📊 Estadísticas:`);
    console.log(`  - Archivos en BD: ${dbFileNames.size}`);
    console.log(`  - Archivos en disco: ${outputFiles.length}\n`);
    
    let registered = 0;
    
    for (const fileName of outputFiles) {
      if (!dbFileNames.has(fileName)) {
        const filePath = path.join(outDir, fileName);
        const ext = path.extname(fileName).toLowerCase();
        
        let fileType = 'unknown';
        if (ext === '.xlsx') fileType = 'excel';
        else if (ext === '.txt') fileType = 'txt';
        else if (ext === '.zip') fileType = 'zip';
        
        // Registrar como usuario del sistema (id = 1 si existe admin)
        const query = `
          INSERT INTO files (company_id, created_by, name, type, path)
          SELECT 1, COALESCE((SELECT id FROM users LIMIT 1), 1), $1, $2, $3
          ON CONFLICT DO NOTHING
          RETURNING id
        `;
        
        try {
          const result = await db.pool.query(query, [fileName, fileType, filePath]);
          if (result.rows.length > 0) {
            registered++;
            console.log(`  ✅ Registrado: ${fileName} (${fileType})`);
          }
        } catch (e) {
          // Si falla por conflicto o por usuarios, intentar sin ON CONFLICT
          try {
            const simpleQuery = 'INSERT INTO files (company_id, created_by, name, type, path) VALUES (1, 1, $1, $2, $3)';
            await db.pool.query(simpleQuery, [fileName, fileType, filePath]);
            registered++;
            console.log(`  ✅ Registrado: ${fileName} (${fileType})`);
          } catch (e2) {
            console.log(`  ⚠️  Ignorado: ${fileName} (${e2.code || 'error'})`);
          }
        }
      }
    }
    
    console.log(`\n✅ Registro completado. Se agregaron ${registered} archivos\n`);
    
    console.log(`📊 Archivos en BD ahora:`);
    const allFiles = await db.pool.query('SELECT id, name, type FROM files ORDER BY id');
    allFiles.rows.forEach(f => {
      console.log(`  ✅ ID ${String(f.id).padStart(2)} | ${f.type.padEnd(6)} | ${f.name}`);
    });
    
    process.exit(0);
  } catch(e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

registerMissingFiles();
