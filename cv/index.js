// cv plugin — one of your pages is the CV; this decides which one.
//
// There is no CV format to follow and nothing to fill in: a CV here is an
// ordinary page you wrote, and the plugin's whole job is to publish the current
// one at a stable address, attach a download file to it, and keep the CVs you
// aren't using out of search results. plugins/cv/sample-cv.md is a page to
// start from if you want one; ignoring it costs nothing.

import fs from 'node:fs';
import path from 'node:path';

export default {
  /**
   * Two addresses for one document is one too many. When the CV is republished
   * at "url", its source page defers to it — and so does every other page
   * marked `cv: true`, which is how a CV you aren't currently using stays in
   * the repo without competing in search results.
   */
  renderPage(page, html, site, options) {
    if (!page?.url) return html;
    const active = activePage(site, options);
    if (!active) return html;
    const url = publishedUrl(active, options);
    // The CV is staying at its own address: this is the page, so this is where
    // the download button goes.
    if (page.url === active.url && url === active.url) return mark(decorate(html, active, options));
    if (options.hideOthers === false || page.url === url) return html;
    const isSource = page.url === active.url;
    if (!isSource && page.cv !== true) return html;          // an unrelated page
    return deferTo(html, site.config.site.url + url);
  },

  /**
   * Publish the current CV at "url" — a real file in dist/, in sitemap.xml and
   * the search index like any other page. With "url" empty, the CV simply stays
   * at its own address and only the download button is added.
   */
  afterBuild(distPath, site, options) {
    const active = activePage(site, options);
    if (!active) {
      return warn(options.page
        ? `no page called "${options.page}" — set "page" under Plugins → CV → Configure to one of: ${candidates(site).join(', ') || 'none published yet'}.`
        : `no CV chosen yet — set "page" under Plugins → CV → Configure to the page that is your CV (e.g. "pages/resume"), or start from plugins/cv/sample-cv.md.`);
    }

    const url = publishedUrl(active, options);
    if (url === active.url) return; // "url" is empty: the build already published it, button and all

    const target = path.join(distPath, url.slice(1), 'index.html');
    if (fs.existsSync(target)) {
      return warn(`${url} is already a page on this site — the CV was not published there. Point "url" somewhere else, or make that page the CV.`);
    }
    let html = site.renderPage('page', { page: { ...active, url } });
    if (active.stylesheet) {
      html = html.replace('</head>', `<link rel="stylesheet" href="${esc(withBasePath(active.stylesheet, site))}">\n</head>`);
    }
    html = mark(decorate(html, active, options));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, html);
    addToSitemap(distPath, site.config.site.url + url, active.date);
    addToSearchIndex(distPath, active, url, active.content || '');
    if (options.hideOthers !== false) {
      for (const item of [active, ...candidateItems(site)]) {
        if (item.url && item.url !== url) removeFromSitemap(distPath, site.config.site.url + item.url);
      }
    }
  },
};

/** Where the CV is published: "url", or the page's own address when it's empty. */
const publishedUrl = (active, options) => (String(options.url || '').trim() ? normalizeUrl(options.url) : active.url);

/**
 * The page that is currently the CV. Written as "pages/resume", as a bare slug
 * ("resume", searched in `pages` first), or as the page's own URL.
 */
const resolved = new WeakMap(); // one lookup per build, not one per page

function activePage(site, options) {
  if (resolved.has(site)) return resolved.get(site);
  const found = findPage(site, options);
  if (site.collections) resolved.set(site, found);
  return found;
}

function findPage(site, options) {
  const want = String(options.page || '').trim();
  if (!want || !site.collections) return null;
  const all = Object.entries(site.collections);

  if (want.includes('/')) {
    const asUrl = normalizeUrl(want);
    const byUrl = all.flatMap(([, items]) => items).find((item) => item.url === asUrl);
    if (byUrl) return byUrl;
    const [from, ...rest] = want.replace(/^\/+|\/+$/g, '').split('/');
    const found = (site.collections[from] || []).find((item) => item.slug === rest.join('/'));
    if (found) return found;
  } else {
    const ordered = [...all.filter(([name]) => name === 'pages'), ...all.filter(([name]) => name !== 'pages')];
    for (const [, items] of ordered) {
      const found = items.find((item) => item.slug === want);
      if (found) return found;
    }
  }
  return null;
}

/** Every page that could be the CV: the ones marked `cv: true`, plus the current one. */
const candidateItems = (site) => Object.values(site.collections || {}).flat().filter((item) => item.cv === true);
const candidates = (site) => candidateItems(site).map((item) => `${item.collection}/${item.slug}`);

/**
 * Add the download button to the CV's HTML. An <a data-cv-download> anywhere in
 * the page is that button, wherever you put it and however you styled it —
 * otherwise "buttonPosition" puts one at the top or the bottom ("none" leaves
 * the page alone). With no PDF attached, the button prints the page instead;
 * client.js wires that up, and it stays hidden until it does.
 */
function decorate(html, active, options) {
  const pdf = String(active.pdf || options.pdf || '').trim();
  const marker = /<a\b([^>]*\bdata-cv-(?:download|pdf)\b[^>]*)>([\s\S]*?)<\/a>/gi;

  if (marker.test(html)) {
    marker.lastIndex = 0;
    return html.replace(marker, (tag, attrs, text) => {
      // Both patterns require the whitespace before the attribute name, so
      // neither can bite a chunk out of data-cv-download itself.
      const rest = attrs
        .replace(/\s+href\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/\s+download(?=[\s=>]|$)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, '');
      return pdf ? `<a href="${esc(pdf)}" download${rest}>${text}</a>` : `<a${rest} data-cv-print>${text}</a>`;
    });
  }

  const position = options.buttonPosition || 'top';
  if (position === 'none') return html;
  const label = esc(options.buttonLabel || 'Download CV');
  const button = `<p class="cv-download"><a class="cv-button"${pdf ? ` href="${esc(pdf)}" download` : ' data-cv-print'}>${label}</a></p>`;
  // Under the page's title if it has one, else at the top of its content; at
  // the bottom, just inside whatever wraps the page.
  if (position === 'bottom') {
    return insertBeforeLast(html, '</article>', button) ?? insertBeforeLast(html, '</main>', button) ?? html + button;
  }
  if (/<\/h1\s*>/i.test(html)) return html.replace(/<\/h1\s*>/i, (tag) => `${tag}\n${button}`);
  return html.replace(/<article\b[^>]*>/i, (tag) => `${tag}\n${button}`);
}

/** Mark the CV's <body>, which is all client.css keys its styling and print sheet on. */
const mark = (html) => html.replace(/<body\b/i, '<body data-cv');

/** Insert before the last occurrence of a closing tag; null when it isn't there. */
function insertBeforeLast(html, closer, snippet) {
  const re = new RegExp(closer, 'gi');
  let at = -1;
  for (let m; (m = re.exec(html)) !== null; ) at = m.index;
  return at === -1 ? null : html.slice(0, at) + snippet + html.slice(at);
}

/** Point a duplicate at the real thing: canonical to the CV, and out of the index. */
function deferTo(html, url) {
  const canonical = `<link rel="canonical" href="${esc(url)}">`;
  const withCanonical = /<link rel="canonical"[^>]*>/i.test(html)
    ? html.replace(/<link rel="canonical"[^>]*>/i, canonical)
    : html.replace('</head>', `${canonical}\n</head>`);
  return withCanonical.replace('</head>', '<meta name="robots" content="noindex, follow">\n</head>');
}

const warn = (message) => console.log(`  ⚠ cv: ${message}`);

/** Root-relative URLs need the site's basePath — the build rewrote the page's own already. */
function withBasePath(url, site) {
  const base = String(site.config.site.basePath || '').replace(/\/+$/, '');
  return base && url.startsWith('/') && !url.startsWith('//') ? base + url : url;
}

/** Add the published CV to sitemap.xml, where the build's own pages already are. */
function addToSitemap(distPath, loc, lastmod) {
  const file = path.join(distPath, 'sitemap.xml');
  if (!fs.existsSync(file)) return;
  const xml = fs.readFileSync(file, 'utf8');
  if (xml.includes(`<loc>${escXml(loc)}</loc>`)) return;
  const entry = `  <url><loc>${escXml(loc)}</loc>${lastmod ? `<lastmod>${escXml(lastmod)}</lastmod>` : ''}</url>\n`;
  fs.writeFileSync(file, xml.replace('</urlset>', `${entry}</urlset>`));
}

/** Drop one URL from sitemap.xml — a page the CV now stands in for. */
function removeFromSitemap(distPath, loc) {
  const file = path.join(distPath, 'sitemap.xml');
  if (!fs.existsSync(file)) return;
  const xml = fs.readFileSync(file, 'utf8');
  const entry = new RegExp(`^ *<url><loc>${escapeRe(escXml(loc))}</loc>.*$\\n?`, 'm');
  if (entry.test(xml)) fs.writeFileSync(file, xml.replace(entry, ''));
}

/** And into search-index.json, so the site's own search can find the CV. */
function addToSearchIndex(distPath, active, url, content) {
  const file = path.join(distPath, 'search-index.json');
  if (!fs.existsSync(file)) return;
  let entries;
  try { entries = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return; }
  if (!Array.isArray(entries)) return;
  entries.push({
    url,
    title: active.title || active.slug,
    description: active.description || '',
    tags: active.tags || [],
    text: stripHtml(content).slice(0, 2000),
  });
  fs.writeFileSync(file, JSON.stringify(entries) + '\n');
}

/** "/resume", "resume/" and "pages/resume" all normalize to a leading-and-trailing-slash path. */
function normalizeUrl(url) {
  const clean = String(url || '').trim().replace(/^\/*/, '/').replace(/\/*$/, '/');
  return clean === '/' ? '/' : clean;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const stripHtml = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const escXml = (s) => esc(s).replace(/'/g, '&apos;');
