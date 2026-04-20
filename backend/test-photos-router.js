// Test directo del router de fotos
require('dotenv').config();

const express = require('express');
const photosRoutes = require('./src/photosRoutes');

const app = express();
app.use(express.json());

// Montar el router
console.log('\n🔧 Montando router de fotos...\n');
app.use('/photos', photosRoutes);

// Test con app.listen
const PORT = 3002;
app.listen(PORT, () => {
  console.log(`✅ Servidor de prueba en puerto ${PORT}`);
  console.log(`📍 Accede a http://localhost:${PORT}/photos/test-sse\n`);
  
  // Hacer test inmediatamente
  setTimeout(() => {
    const http = require('http');
    
    const req = http.get(`http://localhost:${PORT}/photos/test-sse`, (res) => {
      console.log(`✅ Respuesta recibida: ${res.statusCode} ${res.statusMessage}`);
      console.log(`Content-Type: ${res.headers['content-type']}`);
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (data) console.log(`Body (primeros 100 chars): ${data.substring(0, 100)}`);
        console.log('');
        res.destroy();
        process.exit(0);
      });
    });
    
    req.on('error', err => {
      console.log(`❌ Error: ${err.message}`);
      process.exit(1);
    });
    
    setTimeout(() => {
      req.destroy();
      console.log('❌ Timeout sin respuesta');
      process.exit(1);
    }, 2000);
  }, 500);
});
