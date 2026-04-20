const http = require('http');

console.log('\n🧪 Testing endpoints:\n');

const urls = [
  'http://localhost:3001/api/photos-test',  // Direct endpoint in server.js
  'http://localhost:3001/api/photos/test-sse?companyId=4',  // Router endpoint
];

async function testUrl(url) {
  return new Promise(resolve => {
    console.log(`📍 ${url}`);
    const req = http.get(url, (res) => {
      console.log(`   Status: ${res.statusCode}\n`);
      res.destroy();
      resolve();
    });
    req.on('error', err => {
      console.log(`   Error: ${err.message}\n`);
      resolve();
    });
    setTimeout(() => req.destroy(), 1000);
  });
}

(async () => {
  for (const url of urls) {
    await testUrl(url);
  }
  process.exit(0);
})();
