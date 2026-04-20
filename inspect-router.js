// Inspeccionar router directamente
const express = require('express');

// Crear app
const app = express();
app.use(express.json());

// Importar router
const photosRoutes = require('./backend/src/photosRoutes');

// Registrar
app.use('/api/companies/:companyId/photos', photosRoutes);

// Inspeccionar stack
console.log('\n📋 Inspeccionando stack de Express:\n');
app._router.stack.forEach((layer, i) => {
  if (layer.name === 'router') {
    console.log(`${i}: [ROUTER] ${layer.regexp}`);
  } else if (layer.name === 'middleware') {
    console.log(`${i}: [MIDDLEWARE] ${layer.middleware.name || 'anonymous'}`);
  } else {
    console.log(`${i}: [${layer.name}]`);
  }
});

console.log('\n📋 Inspeccionando rutas internas del photosRouter:\n');

// Acceder al router interno
let photosRouter = null;
app._router.stack.forEach(layer => {
  if (layer.name === 'router' && layer.regexp.toString().includes('companies')) {
    photosRouter = layer.handle;
  }
});

if (photosRouter) {
  console.log(`Router encontrado`);
  console.log(`Total de capas: ${photosRouter.stack.length}`);
  
  // Mostrar cada ruta
  photosRouter.stack.forEach((layer, i) => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
      const path = layer.route.path;
      console.log(`   ${i}: [${methods}] ${path}`);
    } else if (layer.name === 'middleware') {
      console.log(`   ${i}: [MIDDLEWARE] ${layer.middleware.name || 'anonymous'}`);
    }
  });
} else {
  console.log(`❌ Router NO encontrado`);
}
