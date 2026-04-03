const { Pool } = require('pg');
require('dotenv').config();

// Conexión a PostgreSQL (Render, Supabase, etc.)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false
});

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

// Función para obtener archivos ordenados (solo activos)
async function getFiles() {
  try {
    const result = await pool.query('SELECT * FROM files WHERE deleted_at IS NULL ORDER BY created_at DESC');
    return result.rows;
  } catch (err) {
    console.error('Error obteniendo archivos:', err);
    throw err;
  }
}

// Función para obtener archivos por tipo (solo activos)
async function getFilesByType(type) {
  try {
    const result = await pool.query('SELECT * FROM files WHERE type = $1 AND deleted_at IS NULL ORDER BY created_at DESC', [type]);
    return result.rows;
  } catch (err) {
    console.error('Error obteniendo archivos por tipo:', err);
    throw err;
  }
}

// Función para obtener archivo por ID (solo si está activo)
async function getFileById(id) {
  try {
    const result = await pool.query('SELECT * FROM files WHERE id = $1 AND deleted_at IS NULL', [id]);
    return result.rows[0];
  } catch (err) {
    console.error('Error obteniendo archivo:', err);
    throw err;
  }
}

// Función para soft delete archivo (marcarlo como eliminado)
async function deleteFile(id) {
  try {
    const result = await pool.query('UPDATE files SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING *', [id]);
    return result.rows[0];
  } catch (err) {
    console.error('Error eliminando archivo:', err);
    throw err;
  }
}

// ===== FUNCIONES PARA USUARIOS (RBAC) =====

async function createUser(username, email, passwordHash, role = 'user') {
  try {
    const query = 'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role, created_at';
    const result = await pool.query(query, [username, email, passwordHash, role]);
    return result.rows[0];
  } catch (err) {
    console.error('Error creando usuario:', err);
    throw err;
  }
}

async function getUserByUsername(username) {
  try {
    console.log(`📊 BD: Buscando usuario "${username}" en tabla "users"...`);
    const query = 'SELECT * FROM users WHERE username = $1 AND deleted_at IS NULL';
    const result = await pool.query(query, [username]);
    console.log(`📊 BD: Resultado: ${result.rows.length} fila(s) encontrada(s)`);
    return result.rows[0];
  } catch (err) {
    console.error('❌ Error obteniendo usuario:', err.message);
    throw err;
  }
}

async function getUserById(id) {
  try {
    const query = 'SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = $1 AND deleted_at IS NULL';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  } catch (err) {
    console.error('Error obteniendo usuario:', err);
    throw err;
  }
}

async function updateUserPassword(userId, passwordHash) {
  try {
    const query = 'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, username, email, role';
    const result = await pool.query(query, [passwordHash, userId]);
    return result.rows[0];
  } catch (err) {
    console.error('Error actualizando contraseña:', err);
    throw err;
  }
}

async function getAllUsers() {
  try {
    const query = 'SELECT id, username, email, role, created_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC';
    const result = await pool.query(query);
    return result.rows;
  } catch (err) {
    console.error('Error obteniendo usuarios:', err);
    throw err;
  }
}

async function updateUserRole(userId, newRole) {
  try {
    const query = 'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, username, email, role';
    const result = await pool.query(query, [newRole, userId]);
    return result.rows[0];
  } catch (err) {
    console.error('Error actualizando rol:', err);
    throw err;
  }
}

async function deleteUser(userId) {
  try {
    const query = 'UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING id, username, email';
    const result = await pool.query(query, [userId]);
    return result.rows[0];
  } catch (err) {
    console.error('Error eliminando usuario:', err);
    throw err;
  }
}

// ===== FUNCIONES PARA EMPRESAS =====

async function createCompany(name, userId) {
  try {
    const query = 'INSERT INTO companies (name, created_by) VALUES ($1, $2) RETURNING id, name, created_by, created_at';
    const result = await pool.query(query, [name, userId]);
    
    const companyId = result.rows[0].id;
    
    // Agregar creator como admin de la empresa
    await pool.query(
      'INSERT INTO company_members (user_id, company_id, role) VALUES ($1, $2, $3)',
      [userId, companyId, 'admin']
    );
    
    return result.rows[0];
  } catch (err) {
    console.error('Error creando empresa:', err);
    throw err;
  }
}

async function getCompaniesByUserId(userId) {
  try {
    const query = `
      SELECT c.id, c.name, c.created_by, c.created_at, cm.role as user_role
      FROM companies c
      JOIN company_members cm ON c.id = cm.company_id
      WHERE cm.user_id = $1 AND c.deleted_at IS NULL AND cm.deleted_at IS NULL
      ORDER BY c.created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (err) {
    console.error('Error obteniendo empresas:', err);
    throw err;
  }
}

async function getAllCompanies() {
  try {
    const query = 'SELECT id, name, created_by, created_at FROM companies WHERE deleted_at IS NULL ORDER BY created_at DESC';
    const result = await pool.query(query);
    return result.rows;
  } catch (err) {
    console.error('Error obteniendo todas las empresas:', err);
    throw err;
  }
}

async function deleteCompany(companyId) {
  try {
    const query = 'UPDATE companies SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING id, name';
    const result = await pool.query(query, [companyId]);
    return result.rows[0];
  } catch (err) {
    console.error('Error eliminando empresa:', err);
    throw err;
  }
}

async function getCompanyMembers(companyId) {
  try {
    const query = `
      SELECT u.id, u.username, u.email, u.role as global_role, cm.role as company_role, cm.created_at
      FROM company_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.company_id = $1 AND u.deleted_at IS NULL AND cm.deleted_at IS NULL
      ORDER BY cm.created_at DESC
    `;
    const result = await pool.query(query, [companyId]);
    return result.rows;
  } catch (err) {
    console.error('Error obteniendo members de empresa:', err);
    throw err;
  }
}

async function addUserToCompany(userId, companyId, role = 'user') {
  try {
    const query = 'INSERT INTO company_members (user_id, company_id, role) VALUES ($1, $2, $3) RETURNING *';
    const result = await pool.query(query, [userId, companyId, role]);
    return result.rows[0];
  } catch (err) {
    console.error('Error agregando usuario a empresa:', err);
    throw err;
  }
}

async function removeUserFromCompany(userId, companyId) {
  try {
    const query = 'UPDATE company_members SET deleted_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND company_id = $2 AND deleted_at IS NULL RETURNING *';
    const result = await pool.query(query, [userId, companyId]);
    return result.rows[0];
  } catch (err) {
    console.error('Error removiendo usuario de empresa:', err);
    throw err;
  }
}

// ===== FUNCIONES PARA ARCHIVOS MEJORADAS =====

async function saveFileWithCompany(companyId, createdBy, name, type, filePath) {
  try {
    const query = 'INSERT INTO files (company_id, created_by, name, type, path) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, type, created_at';
    const result = await pool.query(query, [companyId, createdBy, name, type, filePath]);
    return result.rows[0];
  } catch (err) {
    console.error('Error guardando archivo:', err);
    throw err;
  }
}

// ✨ NUEVA FUNCIÓN: Guardar con contenido del archivo (BLOB)
async function saveFileWithCompanyAndData(companyId, createdBy, name, type, fileBuffer) {
  try {
    const query = 'INSERT INTO files (company_id, created_by, name, type, file_data, path) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, type, created_at';
    // Guardar el buffer como BLOB + una nota que dice dónde está
    const result = await pool.query(query, [companyId, createdBy, name, type, fileBuffer, 'stored_in_database']);
    return result.rows[0];
  } catch (err) {
    console.error('Error guardando archivo con datos:', err);
    throw err;
  }
}

// Obtener archivo por ID (incluyendo contenido si existe)
async function getFileByIdWithData(id) {
  try {
    const query = 'SELECT id, name, type, created_at, file_data, path FROM files WHERE id = $1 AND deleted_at IS NULL';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  } catch (err) {
    console.error('Error obteniendo archivo:', err);
    throw err;
  }
}

async function getFilesByCompany(companyId) {
  try {
    const query = 'SELECT id, name, type, created_at, path FROM files WHERE company_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC';
    const result = await pool.query(query, [companyId]);
    return result.rows;
  } catch (err) {
    console.error('Error obteniendo archivos por empresa:', err);
    throw err;
  }
}

async function getFilesByCompanyAndType(companyId, type) {
  try {
    const query = 'SELECT id, name, type, created_at, path FROM files WHERE company_id = $1 AND type = $2 AND deleted_at IS NULL ORDER BY created_at DESC';
    const result = await pool.query(query, [companyId, type]);
    return result.rows;
  } catch (err) {
    console.error('Error obteniendo archivos por tipo:', err);
    throw err;
  }
}

async function getFileById(id) {
  try {
    const query = 'SELECT * FROM files WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  } catch (err) {
    console.error('Error obteniendo archivo:', err);
    throw err;
  }
}

async function deleteFileById(id) {
  try {
    const query = 'UPDATE files SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  } catch (err) {
    console.error('Error eliminando archivo:', err);
    throw err;
  }
}

// ===== FUNCIONES PARA FOTOS DE REPORTES =====

async function savePhoto(companyId, photoDate, filename, filePath, uploadedBy) {
  try {
    const query = `
      INSERT INTO photos (company_id, photo_date, filename, path, uploaded_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, company_id, photo_date, filename, path, created_at
    `;
    const result = await pool.query(query, [companyId, photoDate, filename, filePath, uploadedBy]);
    return result.rows[0];
  } catch (err) {
    console.error('Error guardando foto:', err);
    throw err;
  }
}

// ✨ NUEVA FUNCIÓN: Guardar foto con contenido (BLOB)
async function savePhotoWithData(companyId, photoDate, filename, photoBuffer, uploadedBy) {
  try {
    const query = `
      INSERT INTO photos (company_id, photo_date, filename, photo_data, path, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, company_id, photo_date, filename, created_at
    `;
    const result = await pool.query(query, [companyId, photoDate, filename, photoBuffer, 'stored_in_database', uploadedBy]);
    return result.rows[0];
  } catch (err) {
    console.error('Error guardando foto con datos:', err);
    throw err;
  }
}

async function getPhotosByMonthAndCompany(companyId, year, month) {
  try {
    // Ordenar por photo_date (para que salgan en orden de fecha) y luego por created_at (para mantener orden de subida dentro del mismo día)
    // Convertir photo_date a formato YYYY-MM-DD como string
    const query = `
      SELECT id, company_id, TO_CHAR(photo_date, 'YYYY-MM-DD') as photo_date, filename, path, uploaded_by, created_at
      FROM photos
      WHERE company_id = $1
        AND EXTRACT(YEAR FROM photo_date) = $2
        AND EXTRACT(MONTH FROM photo_date) = $3
        AND is_deleted = false
      ORDER BY photo_date ASC, created_at ASC
    `;
    const result = await pool.query(query, [companyId, year, month]);
    return result.rows;
  } catch (err) {
    console.error('Error obteniendo fotos del mes:', err);
    throw err;
  }
}

async function getPhotoById(photoId) {
  try {
    const query = 'SELECT * FROM photos WHERE id = $1 AND is_deleted = false';
    const result = await pool.query(query, [photoId]);
    return result.rows[0];
  } catch (err) {
    console.error('Error obteniendo foto:', err);
    throw err;
  }
}

// Obtener foto incluyendo contenido si existe
async function getPhotoByIdWithData(photoId) {
  try {
    const query = 'SELECT id, company_id, photo_date, filename, photo_data, path, uploaded_by FROM photos WHERE id = $1 AND is_deleted = false';
    const result = await pool.query(query, [photoId]);
    return result.rows[0];
  } catch (err) {
    console.error('Error obteniendo foto:', err);
    throw err;
  }
}

async function markPhotoAsDeleted(photoId) {
  try {
    const query = `
      UPDATE photos
      SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, company_id, photo_date, filename, path, is_deleted
    `;
    const result = await pool.query(query, [photoId]);
    return result.rows[0];
  } catch (err) {
    console.error('Error eliminando foto:', err);
    throw err;
  }
}

async function getPhotosByDate(companyId, photoDate) {
  try {
    const query = `
      SELECT id, company_id, photo_date, filename, path, created_at
      FROM photos
      WHERE company_id = $1
        AND photo_date = $2
        AND is_deleted = false
      ORDER BY created_at ASC
    `;
    const result = await pool.query(query, [companyId, photoDate]);
    return result.rows;
  } catch (err) {
    console.error('Error obteniendo fotos por fecha:', err);
    throw err;
  }
}

// ===== FUNCIONES PARA CONFIG POR EMPRESA =====

async function getCompanyConfig(companyId) {
  try {
    const query = 'SELECT config_data FROM company_config WHERE company_id = $1';
    const result = await pool.query(query, [companyId]);
    return result.rows[0]?.config_data || null;
  } catch (err) {
    console.error('Error obteniendo config:', err);
    throw err;
  }
}

async function saveCompanyConfig(companyId, configData) {
  try {
    const query = `
      INSERT INTO company_config (company_id, config_data) VALUES ($1, $2)
      ON CONFLICT (company_id) DO UPDATE SET config_data = $2, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const result = await pool.query(query, [companyId, configData]);
    return result.rows[0];
  } catch (err) {
    console.error('Error guardando config:', err);
    throw err;
  }
}

module.exports = {
  pool,
  // Legado (después migrar)
  saveFile, getFiles, getFilesByType, getFileById, deleteFile,
  // Usuarios
  createUser, getUserByUsername, getUserById, updateUserPassword, getAllUsers, updateUserRole, deleteUser,
  // Empresas
  createCompany, getCompaniesByUserId, getAllCompanies, deleteCompany, getCompanyMembers, addUserToCompany, removeUserFromCompany,
  // Archivos mejorados
  saveFileWithCompany, getFilesByCompany, getFilesByCompanyAndType, getFileById, deleteFileById,
  // Archivos con BLOB (nuevo)
  saveFileWithCompanyAndData, getFileByIdWithData,
  // Fotos para reportes
  savePhoto, savePhotoWithData, getPhotosByMonthAndCompany, getPhotoById, getPhotoByIdWithData, markPhotoAsDeleted, getPhotosByDate,
  // Config
  getCompanyConfig, saveCompanyConfig
};