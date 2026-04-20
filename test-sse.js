// Script para testear SSE desde Node.js
const http = require('http');

console.log('\n🧪 ===== PRUEBA DE CONEXIÓN SSE =====\n');

// Test 1: Probar endpoint de test (sin autenticación)
console.log('📍 Test 1: Probando /test-sse (sin autenticación)...\n');

const testUrl = 'http://localhost:3001/api/companies/4/photos/test-sse';
console.log(`   URL: ${testUrl}\n`);

const req = http.get(testUrl, (res) => {
  console.log(`✅ Conectado!`);
  console.log(`   Status: ${res.statusCode}`);
  console.log(`   Content-Type: ${res.headers['content-type']}\n`);
  
  let eventCount = 0;
  let buffer = '';

  res.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n\n');
    
    for (let i = 0; i < lines.length - 1; i++) {
      eventCount++;
      console.log(`📡 Evento ${eventCount} recibido:`);
      console.log(`   ${lines[i].split('\n').join('\n   ')}\n`);
    }
    
    buffer = lines[lines.length - 1];
  });

  res.on('end', () => {
    console.log(`✅ Conexión cerrada después de ${eventCount} eventos\n`);
    console.log('🎉 ¡SSE FUNCIONA CORRECTAMENTE!\n');
    console.log('Si ves estos eventos, el endpoint SSE está trabajando bien.');
    console.log('El problema está en la autenticación del token JWT.\n');
  });

  res.on('error', (err) => {
    console.error(`❌ Error:`, err.message);
  });
});

req.on('error', (err) => {
  console.error(`\n❌ No se pudo conectar a ${testUrl}`);
  console.error(`   Error: ${err.message}`);
  console.error(`\n   Verifica que el backend está corriendo en puerto 3001\n`);
});

// Timeout
setTimeout(() => {
  console.log('⏱️  Timeout - cerrando prueba\n');
  process.exit(0);
}, 6000);
