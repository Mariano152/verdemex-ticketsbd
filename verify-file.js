// Verificar si el archivo tiene el código correcto
const fs = require('fs');

console.log('\n🔍 Verificando contenido de photosRoutes.js...\n');

const filePath = './backend/src/photosRoutes.js';
const content = fs.readFileSync(filePath, 'utf8');

// Buscar las rutas nuevas
const has_test_sse = content.includes("router.get('/test-sse'");
const has_report_progress = content.includes("router.get('/report-progress/:year/:month'");
const has_sse_middleware = content.includes("const sseAuthMiddleware");

console.log(`✅ /test-sse en archivo: ${has_test_sse ? '✅ SÍ' : '❌ NO'}`);
console.log(`✅ /report-progress en archivo: ${has_report_progress ? '✅ SÍ' : '❌ NO'}`);
console.log(`✅ sseAuthMiddleware en archivo: ${has_sse_middleware ? '✅ SÍ' : '❌ NO'}`);

// Contar líneas
const lines = content.split('\n').length;
console.log(`\n📊 Total de líneas: ${lines}`);

// Verificar module.exports
const has_exports = content.includes('module.exports = router');
console.log(`✅ module.exports: ${has_exports ? '✅ SÍ' : '❌ NO'}`);

// Buscar la ruta /test-sse y mostrar contexto
const lines_array = content.split('\n');
const test_sse_line = lines_array.findIndex(line => line.includes("router.get('/test-sse'"));

if (test_sse_line !== -1) {
  console.log(`\n📌 /test-sse encontrada en línea ${test_sse_line + 1}`);
  console.log(`\nContexto:\n`);
  for (let i = Math.max(0, test_sse_line - 3); i < Math.min(lines_array.length, test_sse_line + 15); i++) {
    const marker = i === test_sse_line ? '>>> ' : '    ';
    console.log(`${marker}${i + 1}: ${lines_array[i]}`);
  }
}

console.log('\n✅ Verificación completada\n');
