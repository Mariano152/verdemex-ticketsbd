// Test para verificar si el router está montado

const http = require('http');

console.log('\n🔍 Testing router paths...\n');

// Voy a probar rutas que ya existían antes para ver si el router funciona
const urls = [
  // Montadas en: /api/companies/:companyId/photos
  { url: 'http://localhost:3001/api/companies/4/photos/view/1', method: 'GET' },
  { url: 'http://localhost:3001/api/companies/4/photos/2024/3', method: 'GET' },
  // Nuevas rutas agregadas
  { url: 'http://localhost:3001/api/companies/4/photos/test-sse', method: 'GET' },
];

async function testUrl(urlObj) {
  return new Promise((resolve) => {
    console.log(`📍 ${urlObj.method} ${urlObj.url}`);
    
    const req = http.get(urlObj.url, (res) => {
      console.log(`   ✅ Status: ${res.statusCode}\n`);
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
  for (const obj of urls) {
    await testUrl(obj);
  }
  console.log('✅ Done\n');
  process.exit(0);
})();
