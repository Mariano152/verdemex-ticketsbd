#!/usr/bin/env node
/**
 * Script para crear el primer usuario admin
 * 
 * Uso: node src/setupAdmin.js
 */

const inquirer = require('inquirer');
const bcrypt = require('bcryptjs');
const db = require('./database');

async function setupAdmin() {
  try {
    console.log('\n\n🔐 =======================================');
    console.log('   CONFIGURACIÓN DEL PRIMER USUARIO ADMIN');
    console.log('======================================= 🔐\n');
    
    // Hacer preguntas al usuario
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'username',
        message: '👤 Nombre de usuario:',
        default: 'admin',
        validate: (input) => {
          if (!input.trim()) return 'El nombre de usuario no puede estar vacío';
          if (input.length < 3) return 'Mínimo 3 caracteres';
          return true;
        }
      },
      {
        type: 'input',
        name: 'email',
        message: '📧 Email:',
        default: 'admin@verdemex.com',
        validate: (input) => {
          if (!input.includes('@')) return 'Ingresa un email válido';
          return true;
        }
      },
      {
        type: 'password',
        name: 'password',
        message: '🔑 Contraseña:',
        mask: '*',
        validate: (input) => {
          if (input.length < 6) return 'Mínimo 6 caracteres';
          return true;
        }
      },
      {
        type: 'password',
        name: 'confirmPassword',
        message: '🔐 Confirmar contraseña:',
        mask: '*',
        validate: (input, answers) => {
          if (input !== answers.password) return 'Las contraseñas no coinciden';
          return true;
        }
      }
    ]);

    const { username, email, password } = answers;

    // Verificar si el usuario ya existe
    console.log(`\n⏳ Verificando si ${username} ya existe...`);
    const existingUser = await db.getUserByUsername(username);
    
    if (existingUser) {
      console.error(`\n❌ Error: El usuario "${username}" ya existe en la base de datos`);
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Rol: ${existingUser.role}\n`);
      process.exit(1);
    }

    // Crear el usuario
    console.log(`\n⏳ Creando usuario admin...`);
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.createUser(username, email, passwordHash, 'admin');

    console.log(`\n✅ ¡Usuario admin creado exitosamente!\n`);
    console.log(`📋 Detalles:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Usuario: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Rol: ${user.role}`);
    console.log(`   Creado: ${user.created_at}\n`);

    console.log('🚀 Ya puedes iniciar sesión con:');
    console.log(`   Usuario: ${user.username}`);
    console.log(`   Contraseña: (la que pusiste)\n`);

    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}\n`);
    process.exit(1);
  }
}

// Ejecutar si es invocado directamente
if (require.main === module) {
  setupAdmin();
}

module.exports = { setupAdmin };
