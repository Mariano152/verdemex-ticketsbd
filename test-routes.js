// Script para debug de rutas
const http = require('http');

console.log('\n🔍 ===== DEBUG DE RUTAS =====\n');

const urls = [
  'http://localhost:3001/api/companies/4/photos/test-sse',
  'http://localhost:3001/photos/test-sse',
  'http://localhost:3001/api/photos/test-sse'
];

async function testUrl(url) {
  return new Promise((resolve) => {
    console.log(`📍 Probando: ${url}`);
    
    const req = http.get(url, (res) => {
      console.log(`   ✅ Status: ${res.statusCode} ${res.statusMessage}\n`);
      res.destroy();
      resolve();
    });

    req.on('error', (err) => {
      console.log(`   ❌ Error: ${err.message}\n`);
      resolve();
    });

    setTimeout(() => {
      req.destroy();
      resolve();
    }, 1000);
  });
}

(async () => {
  for (const url of urls) {
    await testUrl(url);
  }
  console.log('✅ Prueba completada\n');
  process.exit(0);
})();
