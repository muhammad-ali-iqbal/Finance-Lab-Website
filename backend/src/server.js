require('dotenv').config();

const express = require('express');
const visitsRouter = require('./routes/visits');
const adminRouter = require('./routes/admin');
const blogRouter = require('./routes/blog');
const eventsRouter = require('./routes/events');
const siteImagesRouter = require('./routes/site-images');

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/visit-requests', visitsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/blog-posts', blogRouter);
app.use('/api/events', eventsRouter);
app.use('/api/site-images', siteImagesRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`finance-lab-api listening on port ${PORT}`);
});
