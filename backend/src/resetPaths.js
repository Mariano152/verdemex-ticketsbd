const db = require('./database');

async function resetPaths() {
  try {
    await db.pool.query("UPDATE files SET path = 'SYNC_NEEDED'");
    console.log('✅ Rutas marcadas para sincronización');
    process.exit(0);
  } catch(e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

resetPaths();
