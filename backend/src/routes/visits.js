const express = require('express');
const db = require('../db');
const { sendVisitRequestNotification } = require('../mailer');
const { requireAdmin } = require('../auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/', async (req, res) => {
  const { name, email, affiliation, visitType, preferredDate, message } = req.body || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name is required.' });
  }
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }

  const insert = db.prepare(`
    INSERT INTO visit_requests (name, email, affiliation, visit_type, preferred_date, message)
    VALUES (@name, @email, @affiliation, @visitType, @preferredDate, @message)
  `);

  const info = insert.run({
    name: name.trim(),
    email: email.trim(),
    affiliation: affiliation || null,
    visitType: visitType || null,
    preferredDate: preferredDate || null,
    message: message || null,
  });

  try {
    await sendVisitRequestNotification({ name, email, affiliation, visitType, preferredDate, message });
  } catch (err) {
    console.error('Failed to send visit request notification email:', err.message);
  }

  res.status(201).json({ id: info.lastInsertRowid });
});

router.get('/', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM visit_requests ORDER BY created_at DESC').all();
  res.json(rows);
});

router.patch('/:id', requireAdmin, (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status is required' });

  const result = db.prepare('UPDATE visit_requests SET status = ? WHERE id = ?').run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });

  res.json({ ok: true });
});

module.exports = router;
