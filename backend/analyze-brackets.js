// Análisis de brackets en photosRoutes.js
const fs = require('fs');

const content = fs.readFileSync('./src/photosRoutes.js', 'utf8');
const lines = content.split('\n');

console.log('\n📊 Análisis de estructura de photosRoutes.js\n');

let bracketDepth = 0;
let routerDefinedDepth = -1;

lines.forEach((line, idx) => {
  const lineNum = idx + 1;
  
  // Contar brackets
  const opens = (line.match(/\{/g) || []).length;
  const closes = (line.match(/\}/g) || []).length;
  bracketDepth += opens - closes;
  
  // Marcar importante eventos
  if (line.includes('const router = express.Router')) {
    console.log(`📍 Línea ${lineNum}: Router inicializado`);
    routerDefinedDepth = bracketDepth;
  }
  
  if (line.includes("router.get('/test-sse'")) {
    console.log(`✅ Línea ${lineNum}: router.get('/test-sse') encontrada`);
    console.log(`   Profundidad de brackets: ${bracketDepth}`);
    console.log(`   Línea: ${line.trim().substring(0, 60)}`);
  }
  
  if (line.includes("router.get('/report-progress")) {
    console.log(`✅ Línea ${lineNum}: router.get('/report-progress') encontrada`);
    console.log(`   Profundidad de brackets: ${bracketDepth}`);
  }
  
  if (line.includes('module.exports')) {
    console.log(`📍 Línea ${lineNum}: module.exports encontrado`);
    console.log(`   Profundidad de brackets: ${bracketDepth}`);
  }
});

console.log(`\n📊 Profundidad final de brackets: ${bracketDepth}`);
console.log(`   (Debería ser 0 si el archivo está bien cerrado)\n`);
