const express = require('express');
const { verifyPassword, setSessionCookie, clearSessionCookie, requireAdmin } = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!adminUsername || !adminPasswordHash) {
    return res.status(500).json({ error: 'Admin account is not configured' });
  }

  if (username !== adminUsername || !verifyPassword(password || '', adminPasswordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  setSessionCookie(res, username);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({ username: req.admin.u });
});

module.exports = router;
