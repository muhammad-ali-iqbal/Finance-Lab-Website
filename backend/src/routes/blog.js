const path = require('path');
const fs = require('fs');
const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../auth');
const { renderBlogPost, SLUG_RE } = require('../blogTemplate');

const router = express.Router();

const BLOG_CONTENT_DIR = process.env.BLOG_CONTENT_DIR || path.join(__dirname, '..', '..', 'blog-content');

// Public: used by the homepage to render the "What the Lab Offers" cards
// automatically from whatever posts currently exist (see index.html).
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT slug, title, teaser, updated_at FROM blog_posts ORDER BY title').all();
  res.json(rows);
});

router.use(requireAdmin);

router.get('/:slug', (req, res) => {
  const row = db.prepare('SELECT * FROM blog_posts WHERE slug = ?').get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.put('/:slug', (req, res) => {
  const { slug } = req.params;
  if (!SLUG_RE.test(slug)) {
    return res.status(400).json({ error: 'Slug must be lowercase letters, numbers, and hyphens only.' });
  }

  const { title, teaser, body_md, cta_text } = req.body || {};
  if (!title || !teaser || !body_md || !cta_text) {
    return res.status(400).json({ error: 'title, teaser, body_md, and cta_text are required.' });
  }

  const post = { slug, title, teaser, body_md, cta_text };

  db.prepare(`
    INSERT INTO blog_posts (slug, title, teaser, body_md, cta_text, updated_at)
    VALUES (@slug, @title, @teaser, @body_md, @cta_text, datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      teaser = excluded.teaser,
      body_md = excluded.body_md,
      cta_text = excluded.cta_text,
      updated_at = excluded.updated_at
  `).run(post);

  fs.mkdirSync(BLOG_CONTENT_DIR, { recursive: true });
  fs.writeFileSync(path.join(BLOG_CONTENT_DIR, `${slug}.html`), renderBlogPost(post));

  res.json({ ok: true });
});

router.delete('/:slug', (req, res) => {
  const { slug } = req.params;
  const result = db.prepare('DELETE FROM blog_posts WHERE slug = ?').run(slug);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });

  const filePath = path.join(BLOG_CONTENT_DIR, `${slug}.html`);
  fs.rm(filePath, { force: true }, () => {});

  res.json({ ok: true });
});

module.exports = router;
