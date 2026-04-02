const db = require('./database');

async function cleanupMissingFiles() {
  try {
    console.log('🧹 Limpiando registros de archivos no encontrados...\n');
    
    // IDs de archivos que no existen
    const missingIds = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19];
    
    for (const id of missingIds) {
      const result = await db.pool.query('SELECT name FROM files WHERE id = $1', [id]);
      if (result.rows.length > 0) {
        const fileName = result.rows[0].name;
        await db.pool.query('DELETE FROM files WHERE id = $1', [id]);
        console.log(`  ❌ Eliminado ID ${id}: ${fileName}`);
      }
    }
    
    console.log(`\n✅ Limpieza completada. Se eliminaron ${missingIds.length} registros`);
    console.log(`\n📊 Archivos válidos restantes:`);
    
    const validFiles = await db.pool.query('SELECT id, name, path FROM files ORDER BY id');
    validFiles.rows.forEach(f => {
      console.log(`  ✅ ID ${String(f.id).padStart(2)} | ${f.name}`);
    });
    
    process.exit(0);
  } catch(e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

cleanupMissingFiles();
