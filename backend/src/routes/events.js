const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const db = require('../db');
const { requireAdmin } = require('../auth');

const router = express.Router();

const EVENT_IMAGES_DIR = process.env.EVENT_IMAGES_DIR || path.join(__dirname, '..', '..', 'event-images');

const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(EVENT_IMAGES_DIR, { recursive: true });
      cb(null, EVENT_IMAGES_DIR);
    },
    filename: (req, file, cb) => {
      const ext = MIME_EXT[file.mimetype];
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!MIME_EXT[file.mimetype]) return cb(new Error('Unsupported image type'));
    cb(null, true);
  },
});

function imageFilePath(imagePath) {
  // image_path is stored as e.g. "assets/images/events/<filename>"
  return path.join(EVENT_IMAGES_DIR, path.basename(imagePath));
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM events ORDER BY id DESC').all();
  res.json(rows);
});

router.post('/', requireAdmin, upload.single('image'), (req, res) => {
  const { category, date_label, title, excerpt } = req.body || {};
  if (!category || !date_label || !title || !excerpt) {
    return res.status(400).json({ error: 'category, date_label, title, and excerpt are required.' });
  }

  const image_path = req.file ? `assets/images/events/${req.file.filename}` : null;

  const info = db.prepare(`
    INSERT INTO events (category, date_label, title, excerpt, image_path)
    VALUES (@category, @date_label, @title, @excerpt, @image_path)
  `).run({ category, date_label, title, excerpt, image_path });

  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/:id', requireAdmin, upload.single('image'), (req, res) => {
  const { category, date_label, title, excerpt } = req.body || {};
  if (!category || !date_label || !title || !excerpt) {
    return res.status(400).json({ error: 'category, date_label, title, and excerpt are required.' });
  }

  const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  let image_path = existing.image_path;
  if (req.file) {
    if (existing.image_path) fs.rm(imageFilePath(existing.image_path), { force: true }, () => {});
    image_path = `assets/images/events/${req.file.filename}`;
  }

  db.prepare(`
    UPDATE events SET category = @category, date_label = @date_label, title = @title,
      excerpt = @excerpt, image_path = @image_path, updated_at = datetime('now')
    WHERE id = @id
  `).run({ category, date_label, title, excerpt, image_path, id: req.params.id });

  res.json({ ok: true });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  if (existing.image_path) fs.rm(imageFilePath(existing.image_path), { force: true }, () => {});

  res.json({ ok: true });
});

module.exports = router;
