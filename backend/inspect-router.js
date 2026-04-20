// Inspeccionar router directamente
const express = require('express');

// Crear app
const app = express();
app.use(express.json());

// Importar router
const photosRoutes = require('./src/photosRoutes');

// Registrar
app.use('/api/companies/:companyId/photos', photosRoutes);

// Forzar Express a construir el router
app._router.stack;

// Inspeccionar stack
console.log('\n📋 Inspeccionando stack de Express:\n');

if (!app._router || !app._router.stack) {
  console.log('❌ app._router no disponible');
  process.exit(1);
}

app._router.stack.forEach((layer, i) => {
  if (layer.name === 'router') {
    console.log(`${i}: [ROUTER] Matched: ${layer.regexp}`);
  } else if (layer.name === 'middleware') {
    console.log(`${i}: [MIDDLEWARE] ${layer.middleware.name || 'anonymous'}`);
  } else {
    console.log(`${i}: [${layer.name}]`);
  }
});

console.log('\n🔍 Buscando router de /api/companies/:companyId/photos...\n');

// Bucar todas las layers
app._router.stack.forEach((mainLayer, idx) => {
  // Mirar si es un router
  if (mainLayer.route) {
    console.log(`[${idx}] Direct route: ${mainLayer.route.path}`);
  } else if (mainLayer.name === 'router' && mainLayer.handle && mainLayer.handle.stack) {
    // Es un router consolidado
    const routerStack = mainLayer.handle.stack;
    console.log(`[${idx}] Router stack con ${routerStack.length} capas:`);
    
    routerStack.forEach((layer, layerIdx) => {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
        console.log(`     [${layerIdx}] ${methods.padEnd(6)} ${layer.route.path}`);
      } else if (layer.name === 'middleware') {
        console.log(`     [${layerIdx}] MIDDLEWARE: ${layer.middleware.name || 'anonymous'}`);
      }
    });
  }
});

console.log('');

