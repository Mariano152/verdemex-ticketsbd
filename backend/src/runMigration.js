const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false
});

async function runMigration(migrationFile) {
  try {
    console.log(`\n🔄 Ejecutando migración: ${migrationFile}\n`);
    
    // Leer archivo de migración
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    // Ejecutar cada statement
    const statements = sql.split(';').filter(stmt => stmt.trim());
    let count = 0;
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          const result = await pool.query(statement);
          count++;
          console.log(`✅ Statement ${count} ejecutado`);
        } catch (err) {
          console.error(`❌ Error en statement ${count}:`, err.message);
          throw err;
        }
      }
    }
    
    console.log(`\n✨ Migración completada exitosamente (${count} statements ejecutados)\n`);
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Error en migración:`, err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Ejecutar migración
const migrationFile = process.argv[2] || '../migrations/003_add_soft_deletes.sql';
const fullPath = require('path').join(__dirname, migrationFile);

if (!fs.existsSync(fullPath)) {
  console.error(`❌ Error: Archivo de migración no encontrado: ${fullPath}`);
  process.exit(1);
}

runMigration(fullPath);
