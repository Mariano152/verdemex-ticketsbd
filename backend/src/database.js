const { Pool } = require('pg');

// Conexión a PostgreSQL (Render, Supabase, etc.)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false
});

// Crear tabla si no existe (se ejecuta al iniciar)
pool.query(`CREATE TABLE IF NOT EXISTS files (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  path TEXT NOT NULL
)`).catch(err => console.log('Tabla ya existe o error:', err));

// Test de conexión
pool.query('SELECT NOW()')
  .then(() => console.log('✅ BD conectada correctamente'))
  .catch(err => console.error('❌ Error BD:', err));

// Función para guardar archivo
async function saveFile(name, type, filePath) {
  try {
    const query = 'INSERT INTO files (name, type, path) VALUES ($1, $2, $3) RETURNING id';
    const result = await pool.query(query, [name, type, filePath]);
    return result.rows[0].id;
  } catch (err) {
    console.error('Error guardando archivo:', err);
    throw err;
  }
}

// Función para obtener archivos ordenados
async function getFiles() {
  try {
    const result = await pool.query('SELECT * FROM files ORDER BY created_at DESC');
    return result.rows;
  } catch (err) {
    console.error('Error obteniendo archivos:', err);
    throw err;
  }
}

module.exports = { saveFile, getFiles };