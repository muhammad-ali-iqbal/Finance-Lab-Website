const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const db = require('../db');
const { requireAdmin } = require('../auth');

const router = express.Router();

const SITE_IMAGES_DIR = process.env.SITE_IMAGES_DIR || path.join(__dirname, '..', '..', 'site-images');

const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(SITE_IMAGES_DIR, { recursive: true });
      cb(null, SITE_IMAGES_DIR);
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
  // image_path is stored as e.g. "assets/images/site/<filename>" (uploaded)
  // or "assets/images/car-1.jpg" (bundled default) — only unlink files we manage.
  return path.join(SITE_IMAGES_DIR, path.basename(imagePath));
}

function isManagedUpload(imagePath) {
  return imagePath && imagePath.startsWith('assets/images/site/');
}

function clampPos(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM site_images').all();
  res.json(rows);
});

router.put('/:key', requireAdmin, upload.single('image'), (req, res) => {
  const { key } = req.params;
  if (!db.SITE_IMAGE_KEYS.includes(key)) {
    return res.status(400).json({ error: 'Unknown image slot.' });
  }

  const existing = db.prepare('SELECT * FROM site_images WHERE key = ?').get(key);

  let image_path = existing.image_path;
  if (req.file) {
    if (isManagedUpload(existing.image_path)) fs.rm(imageFilePath(existing.image_path), { force: true }, () => {});
    image_path = `assets/images/site/${req.file.filename}`;
  }
  const image_pos_x = clampPos(req.body.image_pos_x);
  const image_pos_y = clampPos(req.body.image_pos_y);

  db.prepare(`
    UPDATE site_images SET image_path = @image_path, image_pos_x = @image_pos_x,
      image_pos_y = @image_pos_y, updated_at = datetime('now')
    WHERE key = @key
  `).run({ key, image_path, image_pos_x, image_pos_y });

  res.json({ ok: true });
});

router.delete('/:key', requireAdmin, (req, res) => {
  const { key } = req.params;
  const existing = db.prepare('SELECT * FROM site_images WHERE key = ?').get(key);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  if (isManagedUpload(existing.image_path)) fs.rm(imageFilePath(existing.image_path), { force: true }, () => {});

  db.prepare(`
    UPDATE site_images SET image_path = NULL, image_pos_x = 50, image_pos_y = 50,
      updated_at = datetime('now')
    WHERE key = @key
  `).run({ key });

  res.json({ ok: true });
});

module.exports = router;
