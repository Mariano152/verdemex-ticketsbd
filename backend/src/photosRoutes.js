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

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const pdfName = `reporte_fotograafico_${year}_${String(month).padStart(2, '0')}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfName}"`);
    doc.pipe(res);

    // Encabezado
    const monthNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const monthName = monthNames[parseInt(month)];

    doc.fontSize(20).font('Helvetica-Bold').text('REPORTE FOTOGRÁFICO', { align: 'center' });
    doc.fontSize(14).font('Helvetica').text(`${monthName} ${year}`, { align: 'center' });
    doc.moveDown();

    // Agrupar fotos por fecha
    const photosByDate = {};
    photos.forEach(photo => {
      let dateStr = String(photo.photo_date).trim();
      if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
      if (!photosByDate[dateStr]) photosByDate[dateStr] = [];
      photosByDate[dateStr].push(photo);
    });

    const sortedDates = Object.keys(photosByDate).sort();
    const photoPerRow = 4;
    let currentY = doc.y;
    let photosInRow = 0;
    let imagesInserted = 0;

    sortedDates.forEach((dateStr) => {
      const photosForDate = photosByDate[dateStr];

      photosForDate.forEach((photo) => {
        let cleanDate = photo.photo_date;
        if (typeof cleanDate === 'string' && cleanDate.includes('T')) cleanDate = cleanDate.split('T')[0];
        if (typeof cleanDate === 'string' && cleanDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [year, month, day] = cleanDate.split('-');
          cleanDate = `${day}-${month}-${year}`;
        }

        if (photosInRow === 0) currentY = doc.y;

        const photoWidth = 100;
        const photoHeight = 100;
        const spacing = 20;
        const startX = 40 + (photosInRow * (photoWidth + spacing));

        try {
          if (photo.photo_data) {
            doc.image(photo.photo_data, startX, currentY, { width: photoWidth, height: photoHeight, fit: [photoWidth, photoHeight] });
            imagesInserted++;
          } else if (photo.path && fs.existsSync(photo.path)) {
            doc.image(photo.path, startX, currentY, { width: photoWidth, height: photoHeight, fit: [photoWidth, photoHeight] });
            imagesInserted++;
          } else {
            doc.text('[No disponible]', startX, currentY, { width: photoWidth, align: 'center' });
          }
        } catch (e) {
          doc.text('[Error]', startX, currentY, { width: photoWidth, align: 'center' });
        }

        doc.fontSize(9).text(cleanDate, startX, currentY + photoHeight + 5, { width: photoWidth, align: 'center' });
        photosInRow++;

        if (photosInRow === photoPerRow) {
          doc.moveDown(7);
          currentY = doc.y;
          photosInRow = 0;
        }
      });
    });

    console.log(`✅ Reporte PDF generado: ${imagesInserted}/${photos.length} imágenes`);
    const duration = Date.now() - startTime;
    console.log(`⏱️  [PDF] Tiempo total: ${duration}ms\n`);
    doc.end();
  } catch (err) {
    console.error('Error en /report:', err.message);
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

