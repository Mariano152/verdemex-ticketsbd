#!/usr/bin/env node
/**
 * Script para promover un usuario admin a superadmin
 * 
 * Uso: node src/promoteSuperadmin.js <username>
 * 
 * Ejemplo: node src/promoteSuperadmin.js admin
 */

const db = require('./database');

async function promoteSuperadmin(username) {
  try {
    console.log(`\n🔄 Buscando usuario: ${username}...`);
    
    const user = await db.getUserByUsername(username);
    if (!user) {
      console.error(`❌ Usuario "${username}" no encontrado`);
      process.exit(1);
    }
    
    if (user.role === 'superadmin') {
      console.log(`⚠️  El usuario "${username}" ya es superadmin`);
      process.exit(0);
    }
    
    console.log(`Promocionando "${username}" (${user.email}) de "${user.role}" a "superadmin"...`);
    
    // Actualizar a superadmin
    const updatedUser = await db.updateUserRole(user.id, 'superadmin');
    
    console.log(`\n✅ Usuario promovido exitosamente!`);
    console.log(`📋 Detalles:`);
    console.log(`   ID: ${updatedUser.id}`);
    console.log(`   Usuario: ${updatedUser.username}`);
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Rol: ${updatedUser.role}`);
    console.log(`\n👑 ${username} es ahora SUPERADMINISTRADOR\n`);
    
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(1);
  }
}

// Obtener username del argumento de la línea de comandos
const username = process.argv[2];
if (!username) {
  console.error(`\n❌ Uso: node src/promoteSuperadmin.js <username>`);
  console.error(`Ejemplo: node src/promoteSuperadmin.js admin\n`);
  process.exit(1);
}

promoteSuperadmin(username);
