// backend/src/photosRoutes.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const db = require('./database');
const { authMiddleware } = require('./auth');
const { formatDateForFilename } = require('./utils');

const router = express.Router({ mergeParams: true });

// Storage para fotos
const photoDataStorage = multer.memoryStorage();
const uploadPhoto = multer({ storage: photoDataStorage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// Carpeta de fotos
const photosDir = path.join(__dirname, '..', 'output', 'photos');
if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });

// ============================================
// 📸 SUBIR FOTO
// ============================================
router.post('/', authMiddleware, uploadPhoto.single('photo'), async (req, res) => {
  try {
    const { companyId } = req.params;
    const { photo_date } = req.body;

    if (!req.file) return res.status(400).json({ error: 'No se subió foto' });
    if (!photo_date) return res.status(400).json({ error: 'Falta la fecha de la foto' });
    if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'Solo se aceptan imágenes' });

    // Nombre: photo_YYYYMMDD_timestamp_original.ext
    const timestamp = Date.now();
    const ext = path.extname(req.file.originalname);
    const dateStr = photo_date.replace(/-/g, '');
    const filename = `photo_${dateStr}_${timestamp}${ext}`;

    // 💾 Guardar directamente como BLOB (sin pasar por filesystem)
    const photo = await db.savePhotoWithData(
      companyId,
      photo_date,
      filename,
      req.file.buffer,  // Guardar el buffer directamente
      req.user.userId
    );

    console.log(`✅ [UPLOAD] Foto guardada exitosamente:`, {
      photoId: photo.id,
      filename: photo.filename,
      date: photo.photo_date,
      bufferSize: req.file.buffer.length,
      company: companyId
    });

    return res.json({
      ok: true,
      photo: {
        id: photo.id,
        photo_date: photo.photo_date,
        filename: photo.filename,
        created_at: photo.created_at
      }
    });
  } catch (err) {
    console.error('Error subiendo foto:', err);
    return res.status(400).json({ error: err.message });
  }
});

// ============================================
// VER FOTO (mostrar en navegador)
// ============================================
router.get('/view/:photoId', authMiddleware, async (req, res) => {
  try {
    const { photoId } = req.params;
    const photo = await db.getPhotoByIdWithData(photoId);
    if (!photo) return res.status(404).json({ error: 'Foto no encontrada' });

    if (photo.photo_data) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Disposition', `inline; filename="${photo.filename}"`);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      return res.send(photo.photo_data);
    }

    if (!fs.existsSync(photo.path)) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    return res.sendFile(photo.path);
  } catch (err) {
    console.error('Error en /view:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

// ============================================
// DESCARGAR FOTO (ruta específica - debe ir ANTES de /:year/:month)
// ============================================
router.get('/file/:photoId', authMiddleware, async (req, res) => {
  try {
    const { photoId } = req.params;

    const photo = await db.getPhotoByIdWithData(photoId);
    if (!photo) return res.status(404).json({ error: 'Foto no encontrada' });

    // Si tiene photo_data (BLOB), enviar desde BD
    if (photo.photo_data) {
      console.log(`Descargando foto desde BD (BLOB): ${photo.filename}`);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${photo.filename}"`);
      return res.send(photo.photo_data);
    }

    // Si no tiene BLOB, intentar desde filesystem (legado)
    if (!fs.existsSync(photo.path)) {
      console.log(`Foto no encontrada en ruta: ${photo.path}`);
      return res.status(404).json({ error: 'Archivo no encontrado en servidor' });
    }

    console.log(`Descargando foto desde disco: ${photo.filename}`);
    return res.sendFile(photo.path);
  } catch (err) {
    console.error('Error descargando foto:', err);
    return res.status(400).json({ error: err.message });
  }
});

// ============================================
// GENERAR PDF DEL REPORTE MENSUAL (ruta específica - debe ir ANTES de /:year/:month)
// ============================================
router.get('/report/:year/:month', authMiddleware, async (req, res) => {
  try {
    const { companyId, year, month } = req.params;
    console.log(`\n📄 [PDF] Iniciando generación - Company: ${companyId}, ${year}-${String(month).padStart(2, '0')}`);
    const startTime = Date.now();

    const photos = await db.getPhotosByMonthAndCompany(companyId, parseInt(year), parseInt(month));
    console.log(`✅ [PDF] Fotos cargadas: ${photos.length}`);

    if (photos.length === 0) {
      console.log(`⚠️  [PDF] Sin fotos para este período`);
      return res.status(404).json({ error: 'No hay fotos para este mes' });
    }

    // Limpiar las fechas
    photos.forEach(photo => {
      let dateStr = String(photo.photo_date).trim();
      const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) photo.photo_date = match[1];
      else if (dateStr.includes('T')) photo.photo_date = dateStr.split('T')[0];
    });

    const doc = new PDFDocument({ size: 'A4', margin: 30 });
    const pdfName = `reporte_fotograafico_${year}_${String(month).padStart(2, '0')}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfName}"`);
    doc.pipe(res);

    // ═══ CONFIGURACIÓN DE PÁGINA ═══
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 30;
    
    // ═══ PLANTILLA DE FONDO (opcional)
    const templatePath = path.join(__dirname, '..', 'output', 'template.png');
    const hasTemplate = fs.existsSync(templatePath);
    
    console.log(`📋 [TEMPLATE] Buscando en: ${templatePath}`);
    console.log(`📋 [TEMPLATE] __dirname: ${__dirname}`);
    console.log(`📋 [TEMPLATE] ¿Plantilla existe? ${hasTemplate ? '✅ SÍ' : '❌ NO'}`);
    
    // Si no existe con .png, intentar con .PNG o .jpg
    let finalTemplatePath = templatePath;
    if (!hasTemplate) {
      const pngUpper = path.join(__dirname, '..', 'output', 'template.PNG');
      const jpg = path.join(__dirname, '..', 'output', 'template.jpg');
      const jpgUpper = path.join(__dirname, '..', 'output', 'template.JPG');
      
      if (fs.existsSync(pngUpper)) {
        console.log(`📋 [TEMPLATE] Encontrada con mayúsculas: template.PNG`);
        finalTemplatePath = pngUpper;
      } else if (fs.existsSync(jpg)) {
        console.log(`📋 [TEMPLATE] Encontrada: template.jpg`);
        finalTemplatePath = jpg;
      } else if (fs.existsSync(jpgUpper)) {
        console.log(`📋 [TEMPLATE] Encontrada con mayúsculas: template.JPG`);
        finalTemplatePath = jpgUpper;
      } else {
        console.log(`📋 [TEMPLATE] No encontrada en ningún formato (usaremos fondo blanco)`);
      }
    }
    
    const hasTemplate2 = fs.existsSync(finalTemplatePath);
    console.log(`📋 [TEMPLATE] Ruta final: ${finalTemplatePath}`);
    console.log(`📋 [TEMPLATE] ¿Existe ruta final? ${hasTemplate2 ? '✅ SÍ' : '❌ NO'}`);
    
    // ═══ CONFIGURACIÓN DE IMÁGENES ═══
    const photoWidth = 130;    // Ancho de foto
    const photoHeight = 130;   // Alto de foto
    const photosPerRow = 3;    // 3 fotos por fila
    const photosPerColumn = 4; // 4 filas máximo por página
    const photosPerPage = photosPerRow * photosPerColumn; // 12 fotos por página
    
    const spacingX = 20;      // Espacio horizontal entre fotos
    const spacingY = 30;      // Espacio vertical entre filas (incluye texto de fecha)
    
    const monthNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const monthName = monthNames[parseInt(month)];

    // ═══ FUNCIÓN: Agregar encabezado (plantilla)
    const addPageHeader = () => {
      console.log(`📋 [HEADER] Agregando encabezado de página...`);
      
      // 🎨 Agregar plantilla de fondo si existe (sin mover el cursor)
      if (hasTemplate2) {
        try {
          console.log(`   🎨 Insertando plantilla de fondo desde: ${finalTemplatePath}`);
          // Guardar posición actual del cursor
          const currentY = doc.y;
          
          // Insertar plantilla en la posición 0,0 de la página
          doc.image(finalTemplatePath, 0, 0, { 
            width: pageWidth, 
            height: pageHeight 
          });
          
          // Restaurar posición del cursor (para que no mueva el texto)
          doc.y = currentY;
          
          console.log(`   ✅ Plantilla de fondo insertada (Y restaurado: ${currentY.toFixed(1)})`);
        } catch (e) {
          console.error(`   ⚠️  Error al insertar plantilla: ${e.message}`);
        }
      }
      
      // Solo agregar texto si NO hay plantilla
      if (!hasTemplate2) {
        doc.fontSize(18).font('Helvetica-Bold').text('REPORTE FOTOGRÁFICO', { align: 'center' });
        doc.fontSize(12).font('Helvetica').text(`${monthName} ${year}`, { align: 'center' });
        doc.moveDown(0.3);
        doc.moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).stroke();
        doc.moveDown(0.5);
      }
      
      const headerEndY = doc.y;
      console.log(`✅ [HEADER] Encabezado completo. Y final: ${headerEndY.toFixed(1)}`);
      return headerEndY;
    };

    // ═══ FUNCIÓN: Calcular posición X,Y basado en índice de posición
    const getPositionForIndex = (indexInPage) => {
      const row = Math.floor(indexInPage / photosPerRow);
      const col = indexInPage % photosPerRow;
      
      // Calcular X: centrado + columna
      const totalRowWidth = (photosPerRow * photoWidth) + ((photosPerRow - 1) * spacingX);
      const contentWidth = pageWidth - (2 * margin);
      const leftPadding = (contentWidth - totalRowWidth) / 2;
      const x = margin + leftPadding + (col * (photoWidth + spacingX));
      
      // Calcular Y: header + filas
      const headerY = 110; // Aproximado después del header
      const y = headerY + (row * (photoHeight + spacingY));
      
      return { x: x.toFixed(1), y: y.toFixed(1), row, col };
    };

    // ═══ AGRUPAR FOTOS POR FECHA
    const photosByDate = {};
    photos.forEach(photo => {
      let dateStr = String(photo.photo_date).trim();
      if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
      if (!photosByDate[dateStr]) photosByDate[dateStr] = [];
      photosByDate[dateStr].push(photo);
    });

    const sortedDates = Object.keys(photosByDate).sort();
    console.log(`\n📊 [INIT] Fotos agrupadas en ${sortedDates.length} días`);
    console.log(`📊 [INIT] Posiciones por página: ${photosPerPage} (${photosPerRow}x${photosPerColumn})`);

    // ═══ INICIALIZAR PRIMERA PÁGINA
    addPageHeader();
    let imagesInserted = 0;
    let imagesInPage = 0;
    let currentPageNumber = 1;

    console.log(`\n🚀 [START] Iniciando colocación de imágenes...`);

    // ═══ PROCESAR CADA FOTO
    sortedDates.forEach((dateStr) => {
      const photosForDate = photosByDate[dateStr];

      photosForDate.forEach((photo) => {
        let cleanDate = photo.photo_date;
        if (typeof cleanDate === 'string' && cleanDate.includes('T')) cleanDate = cleanDate.split('T')[0];
        if (typeof cleanDate === 'string' && cleanDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [photoYear, photoMonth, day] = cleanDate.split('-');
          cleanDate = `${day}-${photoMonth}-${photoYear}`;
        }

        // 🔍 CONTADOR: Verificar si página está llena
        if (imagesInPage >= photosPerPage) {
          console.log(`\n📄 [PAGE FULL] Página ${currentPageNumber} completa (${imagesInPage}/${photosPerPage}). Creando nueva página...`);
          doc.addPage();
          addPageHeader();
          imagesInPage = 0;
          currentPageNumber++;
          console.log(`📄 [NEW PAGE] Página ${currentPageNumber} iniciada\n`);
        }

        // 📍 OBTENER POSICIÓN PREDEFINIDA
        const position = getPositionForIndex(imagesInPage);
        const startX = parseFloat(position.x);
        const startY = parseFloat(position.y);

        console.log(`📸 [IMG ${imagesInserted + 1}/${photos.length}] Página:${currentPageNumber} Pos:${imagesInPage + 1}/${photosPerPage} | X:${position.x} Y:${position.y} (Fila:${position.row} Col:${position.col}) | Fecha:${cleanDate}`);

        // ✅ INSERTAR IMAGEN EN POSICIÓN FIJA
        try {
          if (photo.photo_data) {
            doc.image(photo.photo_data, startX, startY, { 
              width: photoWidth, 
              height: photoHeight, 
              fit: [photoWidth, photoHeight] 
            });
            imagesInserted++;
            console.log(`   ✅ BLOB insertada exitosamente`);
          } else if (photo.path && fs.existsSync(photo.path)) {
            doc.image(photo.path, startX, startY, { 
              width: photoWidth, 
              height: photoHeight, 
              fit: [photoWidth, photoHeight] 
            });
            imagesInserted++;
            console.log(`   ✅ Archivo insertado exitosamente`);
          } else {
            // Placeholder para imagen no disponible
            doc.rect(startX, startY, photoWidth, photoHeight).stroke();
            doc.fontSize(8).text('[No disponible]', startX, startY + (photoHeight / 2) - 5, { 
              width: photoWidth, 
              align: 'center' 
            });
            console.log(`   ⚠️  Placeholder (no disponible)`);
          }
        } catch (e) {
          console.error(`   ❌ ERROR: ${e.message}`);
          // Error placeholder
          doc.rect(startX, startY, photoWidth, photoHeight).stroke();
          doc.fontSize(8).text('[Error]', startX, startY + (photoHeight / 2) - 5, { 
            width: photoWidth, 
            align: 'center' 
          });
        }

        // 📅 AGREGAR TEXTO DE FECHA DEBAJO
        const dateY = startY + photoHeight + 3;
        doc.fontSize(7).font('Helvetica').text(cleanDate, startX, dateY, { 
          width: photoWidth, 
          align: 'center' 
        });

        // ➕ INCREMENTAR CONTADORES
        imagesInPage++;
      });
    });

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ [COMPLETE] PDF Generado exitosamente`);
    console.log(`📊 [STATS] Total imágenes: ${imagesInserted}/${photos.length}`);
    console.log(`📊 [STATS] Páginas generadas: ${currentPageNumber}`);
    console.log(`📊 [STATS] Última página: ${imagesInPage}/${photosPerPage} posiciones usadas`);
    const duration = Date.now() - startTime;
    console.log(`⏱️  [TIME] Tiempo total: ${duration}ms`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    doc.end();
  } catch (err) {
    console.error('❌ [ERROR] Error en /report:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

// ============================================
// OBTENER FOTOS POR MES
// ============================================
router.get('/:year/:month', authMiddleware, async (req, res) => {
  try {
    const { companyId, year, month } = req.params;
    const photos = await db.getPhotosByMonthAndCompany(companyId, parseInt(year), parseInt(month));

    const photosWithUrls = photos.map(p => ({
      ...p,
      viewUrl: `/api/companies/${companyId}/photos/view/${p.id}`,
      downloadUrl: `/api/companies/${companyId}/photos/file/${p.id}`,
      url: `/api/companies/${companyId}/photos/file/${p.id}`
    }));

    return res.json({ ok: true, photos: photosWithUrls });
  } catch (err) {
    console.error('Error en /:year/:month:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

// ============================================
// ❌ ELIMINAR FOTO (marca como deleted)
// ============================================
router.delete('/:photoId', authMiddleware, async (req, res) => {
  try {
    const { photoId } = req.params;

    // Obtener la foto para validar acceso
    const photo = await db.getPhotoById(photoId);
    if (!photo) {
      return res.status(404).json({ error: 'Foto no encontrada' });
    }

    const deletedPhoto = await db.markPhotoAsDeleted(photoId);

    // Opcionalmente eliminar archivo del disco
    try {
      if (fs.existsSync(deletedPhoto.path)) {
        fs.unlinkSync(deletedPhoto.path);
      }
    } catch (e) {
      console.warn('No se pudo eliminar archivo físico:', e.message);
    }

    return res.json({ ok: true, message: 'Foto eliminada' });
  } catch (err) {
    console.error('Error eliminando foto:', err);
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;

