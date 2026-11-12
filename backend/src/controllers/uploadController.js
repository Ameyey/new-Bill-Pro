const db = require('../config/db');
const path = require('path');
const fs = require('fs');

async function getTableColumns(tableName) {
  try {
    const rows = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tableName]
    );
    return Array.isArray(rows) ? rows.map(r => (r.COLUMN_NAME || '').toLowerCase()) : [];
  } catch (e) {
    return [];
  }
}

exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const invoice_id = req.body.invoice_id || null;
    const image_type = req.body.type || req.body.image_type || 'logo';
    const image_slot = parseInt(req.body.slot || req.body.image_slot || '1', 10);

    // Fetch user's existing images
    const existingImages = await db.query('SELECT * FROM invoice_images WHERE user_id = ?', [req.user.id]);

    // Check if replacing an image in the same slot
    const existingSlotImage = existingImages.find(img => img.image_slot === image_slot || (image_slot === 1 && !img.image_slot));
    if (existingSlotImage) {
      const cleanRel = (existingSlotImage.file_path || '').replace(/^\/+/, '');
      if (!cleanRel.startsWith('data:')) {
        const oldFilePath = path.join(__dirname, '../../', cleanRel);
        if (fs.existsSync(oldFilePath)) {
          try { fs.unlinkSync(oldFilePath); } catch (e) {}
        }
      }
      await db.run('DELETE FROM invoice_images WHERE id = ?', [existingSlotImage.id]);
    } else if (existingImages.length >= 2 && !invoice_id) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 2 images are allowed per account. Please delete an existing image first.'
      });
    }

    // Determine storage format: Base64 Data URI on Vercel / serverless (read-only filesystem)
    // or local uploads disk if writable
    let filePath;
    if (req.file.buffer) {
      if (process.env.VERCEL) {
        // Vercel serverless environment: store as persistent Base64 Data URI in DB
        const mime = req.file.mimetype || 'image/png';
        filePath = `data:${mime};base64,${req.file.buffer.toString('base64')}`;
      } else {
        // Local environment: persist to uploads folder if possible
        try {
          const uploadDir = path.join(__dirname, '../../uploads');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          const ext = path.extname(req.file.originalname) || '.png';
          const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
          fs.writeFileSync(path.join(uploadDir, uniqueName), req.file.buffer);
          filePath = `/uploads/${uniqueName}`;
        } catch (diskErr) {
          const mime = req.file.mimetype || 'image/png';
          filePath = `data:${mime};base64,${req.file.buffer.toString('base64')}`;
        }
      }
    } else {
      filePath = `/uploads/${req.file.filename}`;
    }

    // Inspect columns of invoice_images to ensure 100% schema compatibility
    const cols = await getTableColumns('invoice_images');

    // Auto-migrate if image_slot column is missing in older DB
    if (cols.length > 0 && !cols.includes('image_slot')) {
      try {
        await db.exec('ALTER TABLE invoice_images ADD COLUMN image_slot INT DEFAULT 1');
        cols.push('image_slot');
      } catch (e) {}
    }

    // Build query using only columns that genuinely exist
    const insertFields = ['user_id', 'file_path', 'file_name'];
    const insertValues = [req.user.id, filePath, req.file.originalname];

    if (cols.length === 0 || cols.includes('image_slot')) {
      insertFields.push('image_slot');
      insertValues.push(image_slot);
    }
    if (cols.length === 0 || cols.includes('image_type')) {
      insertFields.push('image_type');
      insertValues.push(image_type);
    }
    if (cols.length === 0 || cols.includes('file_size')) {
      insertFields.push('file_size');
      insertValues.push(req.file.size);
    }
    if (cols.length === 0 || cols.includes('mime_type')) {
      insertFields.push('mime_type');
      insertValues.push(req.file.mimetype);
    }
    if (cols.includes('invoice_id')) {
      insertFields.push('invoice_id');
      insertValues.push(invoice_id || null);
    }
    if (cols.includes('invoice_id_or_user_id')) {
      insertFields.push('invoice_id_or_user_id');
      insertValues.push(invoice_id || req.user.id);
    }

    const placeholders = insertFields.map(() => '?').join(', ');
    const sql = `INSERT INTO invoice_images (${insertFields.join(', ')}) VALUES (${placeholders})`;
    const result = await db.run(sql, insertValues);

    // If official company logo (slot 1 or type logo), sync to company_settings & existing invoices
    if (image_type === 'logo' || image_slot === 1) {
      try {
        await db.run('UPDATE company_settings SET logo_url = ? WHERE user_id = ?', [filePath, req.user.id]);
        await db.run('UPDATE invoices SET image1_url = ? WHERE user_id = ?', [filePath, req.user.id]);
      } catch (settingsErr) {
        console.warn('Could not update logo_url in company_settings:', settingsErr.message);
      }
    } else if (image_type === 'signature' || image_slot === 2) {
      try {
        await db.run('UPDATE company_settings SET signature_url = ? WHERE user_id = ?', [filePath, req.user.id]);
        await db.run('UPDATE invoices SET image2_url = ? WHERE user_id = ?', [filePath, req.user.id]);
      } catch (settingsErr) {
        console.warn('Could not update signature_url in company_settings:', settingsErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Image uploaded successfully.',
      image: {
        id: result.lastInsertRowid,
        image_slot,
        file_path: filePath,
        file_name: req.file.originalname,
        file_size: req.file.size,
        image_type
      }
    });
  } catch (error) {
    console.error('uploadImage error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getImages = async (req, res) => {
  try {
    const { invoice_id } = req.query;
    let sql = 'SELECT * FROM invoice_images WHERE user_id = ?';
    const params = [req.user.id];
    if (invoice_id) {
      sql += ' AND (invoice_id = ? OR invoice_id IS NULL)';
      params.push(invoice_id);
    }
    sql += ' ORDER BY id DESC';
    const images = await db.query(sql, params);
    return res.json({ success: true, images });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteImage = async (req, res) => {
  try {
    const { id } = req.params;
    const img = await db.get('SELECT * FROM invoice_images WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (img) {
      const cleanRel = (img.file_path || '').replace(/^\/+/, '');
      if (!cleanRel.startsWith('data:')) {
        const fullPath = path.join(__dirname, '../../', cleanRel);
        if (fs.existsSync(fullPath)) {
          try { fs.unlinkSync(fullPath); } catch (e) {}
        }
      }
      if (img.image_type === 'logo' || img.image_slot === 1) {
        try {
          await db.run('UPDATE company_settings SET logo_url = NULL WHERE user_id = ?', [req.user.id]);
          await db.run('UPDATE invoices SET image1_url = NULL WHERE user_id = ? AND image1_url = ?', [req.user.id, img.file_path]);
        } catch (e) {}
      }
      await db.run('DELETE FROM invoice_images WHERE id = ? AND user_id = ?', [id, req.user.id]);
    }
    return res.json({ success: true, message: 'Image deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
