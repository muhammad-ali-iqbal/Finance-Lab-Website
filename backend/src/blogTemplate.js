const SLUG_RE = /^[a-z0-9-]+$/;

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Body convention: blank-line-separated blocks. "## " starts a heading,
// "- " (repeated on consecutive lines) starts a bullet list, anything else is a paragraph.
function renderBody(md) {
  const blocks = String(md || '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((block) => {
    if (block.startsWith('## ')) {
      return `    <h2>${escapeHtml(block.slice(3).trim())}</h2>`;
    }
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.every((l) => l.startsWith('- '))) {
      const items = lines.map((l) => `      <li>${escapeHtml(l.slice(2).trim())}</li>`).join('\n');
      return `    <ul>\n${items}\n    </ul>`;
    }
    return `    <p>${escapeHtml(block)}</p>`;
  }).join('\n\n');
}

function renderBlogPost(post) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(post.title)} — IBA Finance Lab</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *,*::before,*::after{box-sizing:border-box}
  body{margin:0;background:#faf7f2;font-family:'IBM Plex Sans',sans-serif;-webkit-font-smoothing:antialiased;color:#221d1b}
  a{color:#700f1a}
  a:hover{color:#4a0a12}
  h1,h2,h3{font-family:'IBM Plex Serif',serif}
  .topbar{background:#700f1a;color:#f0d9be;display:flex;justify-content:space-between;align-items:center;padding:7px 40px;font-size:12px}
  .topbar .links{display:flex;gap:22px}
  .topbar a{color:#f0d9be;text-decoration:none}
  .topbar .meta{opacity:.85}
  .header{display:flex;align-items:center;justify-content:space-between;padding:14px 40px;border-bottom:1px solid #e6ddd0}
  .brand{display:flex;align-items:center;gap:12px;text-decoration:none}
  .brand-mark{height:60px;width:auto;flex:none;display:block}
  .brand-text{display:flex;flex-direction:column;line-height:1.15;text-align:left}
  .brand-title{font-family:'IBM Plex Serif',serif;font-weight:700;font-size:19px;color:#221d1b}
  .brand-sub{font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:#7a7268}
  .back-link{font-size:13.5px;font-weight:600;text-decoration:none}
  .page-hero{background:#700f1a;color:#fff;padding:60px 40px}
  .page-hero-inner{max-width:820px;margin:0 auto;display:flex;flex-direction:column;gap:10px}
  .eyebrow-gold{font-size:12.5px;letter-spacing:.09em;text-transform:uppercase;color:#e7bd7d;font-weight:700}
  .page-hero h1{font-weight:700;font-size:36px;margin:0}
  .page-hero p{font-size:15.5px;color:#f3e3d2;max-width:640px;margin:6px 0 0}
  .article{max-width:760px;margin:0 auto;padding:60px 40px 100px;display:flex;flex-direction:column;gap:22px}
  .article h2{font-weight:700;font-size:22px;margin:26px 0 0}
  .article p{font-size:15.5px;line-height:1.75;color:#3a3530;margin:0}
  .article ul{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px}
  .article li{font-size:15px;line-height:1.65;color:#3a3530}
  .cta-band{background:#f2ece1;padding:44px 40px;margin-top:20px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}
  .cta-band p{margin:0;font-size:15px;color:#3a3530}
  .btn-primary{background:#700f1a;color:#fff;border:none;border-radius:5px;padding:12px 22px;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block}
  .footer{background:#4a0a12;color:#f0d9be;margin-top:auto;padding:26px 40px;text-align:center;font-size:12px}
  @media (max-width:700px){
    .topbar,.header,.page-hero,.article,.cta-band{padding-left:20px;padding-right:20px}
    .topbar{flex-direction:column;gap:4px}
  }
</style>
</head>
<body>

  <div class="topbar">
    <div class="links">
      <a href="https://www.iba.edu.pk/" target="_blank">IBA Karachi</a>
      <a href="https://sbs.iba.edu.pk/" target="_blank">School of Business Studies</a>
    </div>
    <div class="meta">University Road, University of Karachi&nbsp;&middot;&nbsp;+92-(213) 810-4700</div>
  </div>
  <div class="header">
    <a class="brand" href="../">
      <img class="brand-mark" src="../assets/images/logo.png" alt="IBA logo">
      <div class="brand-text">
        <span class="brand-title">Finance Lab</span>
        <span class="brand-sub">School of Business Studies</span>
      </div>
    </a>
    <a class="back-link" href="../#offers-section">&larr; Back to What the Lab Offers</a>
  </div>

  <div class="page-hero">
    <div class="page-hero-inner">
      <span class="eyebrow-gold">What the Lab Offers</span>
      <h1>${escapeHtml(post.title)}</h1>
      <p>${escapeHtml(post.teaser)}</p>
    </div>
  </div>

  <div class="article">
${renderBody(post.body_md)}

    <div class="cta-band">
      <p>${escapeHtml(post.cta_text)}</p>
      <a class="btn-primary" href="../#contact">Book a Visit</a>
    </div>
  </div>

  <div class="footer">&copy; IBA Finance Lab &middot; School of Business Studies</div>

</body>
</html>
`;
}

module.exports = { renderBlogPost, renderBody, SLUG_RE };
