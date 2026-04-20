// Forzar reload del módulo sin cache  

// Limpiar cache de require
delete require.cache[require.resolve('./backend/src/photosRoutes.js')];
delete require.cache[require.resolve('./backend/src/server.js')];

// Ahora importar fresco
const http = require('http');
console.log('\n💾 Re-cargando módulos...\n');

// Hacer un GET con lista de rutas para debug
const urls = [
  'http://localhost:3001/api/companies/4/photos/test-sse',
  'http://localhost:3001/api/companies/4/photos/view/1',
];

async function test(url) {
  return new Promise(resolve => {
    const req = http.get(url, (res) => {
      // Leer respuesta completa
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`📍 ${url}`);
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Headers: ${res.headers['content-type']}`);
        if (data && data.length < 200) console.log(`   Body: ${data.substring(0, 100)}`);
        console.log('');
        res.destroy();
        resolve();
      });
    });
    req.on('error', err => {
      console.log(`❌ ${url} - ${err.message}\n`);
      resolve();
    });
    setTimeout(() => req.destroy(), 1000);
  });
}

(async () => {
  for (const url of urls) {
    await test(url);
  }
  process.exit(0);
})();
