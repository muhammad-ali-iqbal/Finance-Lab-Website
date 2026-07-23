const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../auth');

const router = express.Router();

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM site_text').all();
  res.json(rows);
});

router.put('/', requireAdmin, (req, res) => {
  const { values } = req.body || {};
  if (!values || typeof values !== 'object') {
    return res.status(400).json({ error: 'values object is required.' });
  }

  const keys = Object.keys(values);
  for (const key of keys) {
    if (!db.SITE_TEXT_KEYS.includes(key)) {
      return res.status(400).json({ error: `Unknown text key: ${key}` });
    }
    if (typeof values[key] !== 'string') {
      return res.status(400).json({ error: `Value for ${key} must be a string.` });
    }
  }

  const update = db.prepare(`
    UPDATE site_text SET value = @value, updated_at = datetime('now') WHERE key = @key
  `);
  const updateAll = db.transaction((entries) => {
    for (const [key, value] of entries) {
      update.run({ key, value });
    }
  });
  updateAll(Object.entries(values));

  res.json({ ok: true });
});

module.exports = router;
