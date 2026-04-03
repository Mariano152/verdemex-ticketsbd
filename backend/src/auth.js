const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

// Registrar usuario (solo ADMIN puede hacerlo)
async function registerUser(username, email, password, role = 'user', db) {
  const existing = await db.getUserByUsername(username);
  if (existing) throw new Error('Usuario ya existe');
  
  if (!password || password.length < 6) {
    throw new Error('Contraseña debe tener mínimo 6 caracteres');
  }
  
  const passwordHash = await bcrypt.hash(password, 10);
  return await db.createUser(username, email, passwordHash, role);
}

// Login
async function loginUser(username, password, db) {
  console.log(`🔍 Buscando usuario: ${username}`);
  const user = await db.getUserByUsername(username);
  
  if (!user) {
    console.error(`❌ Usuario "${username}" no encontrado en BD`);
    throw new Error('Usuario no encontrado');
  }
  
  console.log(`✅ Usuario encontrado: ${user.username}`);
  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    console.error(`❌ Contraseña incorrecta para ${username}`);
    throw new Error('Contraseña incorrecta');
  }
  
  const token = jwt.sign(
    { 
      userId: user.id, 
      username: user.username, 
      role: user.role,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
  
  return { 
    token, 
    user: { 
      id: user.id, 
      username: user.username, 
      email: user.email, 
      role: user.role,
      created_at: user.created_at
    } 
  };
}

// Cambiar contraseña
async function changePassword(userId, oldPassword, newPassword, db) {
  const user = await db.getUserById(userId);
  if (!user) throw new Error('Usuario no encontrado');
  
  const validPassword = await bcrypt.compare(oldPassword, user.password_hash);
  if (!validPassword) throw new Error('Contraseña actual incorrecta');
  
  if (newPassword.length < 6) {
    throw new Error('Nueva contraseña debe tener mínimo 6 caracteres');
  }
  
  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  return await db.updateUserPassword(userId, newPasswordHash);
}

// Verificar token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    throw new Error('Token inválido o expirado');
  }
}

// Middleware para verificar autenticación
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado - Token requerido' });
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// Middleware para verificar que sea admin global o superadmin
function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Solo administradores pueden hacer esto' });
  }
  next();
}

// Middleware para verificar que sea superadmin
function superadminMiddleware(req, res, next) {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Solo el superadministrador puede hacer esto' });
  }
  next();
}

module.exports = {
  registerUser,
  loginUser,
  changePassword,
  verifyToken,
  authMiddleware,
  adminMiddleware,
  superadminMiddleware
};
