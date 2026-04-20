// Test Express router matching
const express = require('express');
const app = express();

// Crear router
const router = express.Router({ mergeParams: true });

// Agregar ruta con parámetros capciosos (igual a photosRoutes)
router.get('/:year/:month', (req, res) => {
  res.json({ type: 'param-route', params: req.params });
});

// Agregar ruta test-sse
router.get('/test-sse', (req, res) => {
  res.json({ type: 'test-sse-route' });
});

// Montar router
app.use('/api/companies/:companyId/photos', router);

// Crear requests de prueba
const testRequests = [
  { method: 'GET', path: '/api/companies/4/photos/test-sse' },
  { method: 'GET', path: '/api/companies/4/photos/2024/3' },
];

// Test cada ruta
console.log('\n📋 Testing Express router matching:\n');

testRequests.forEach(req => {
  const fakeReq = {
    method: req.method,
    url: req.path,
    path: req.path.replace('/api/companies/4/photos', ''),
    params: {},
    query: {}
  };
  
  const fakeRes = {
    statusCode: 404,
    json: function(data) {
      console.log(`${req.path}`);
      console.log(`  → ${JSON.stringify(data)}\n`);
    }
  };
  
  // Manually test routes
  console.log(`Testing: ${req.path}`);
  
  // Check if /test-sse matches
  if (req.path.endsWith('/test-sse')) {
    console.log(`  → Should match /test-sse route\n`);
  } else if (req.path.match(/\/\d+\/\d+$/)) {
    console.log(`  → Should match /:year/:month route\n`);
  } else {
    console.log(`  → Would return 404\n`);
  }
});
