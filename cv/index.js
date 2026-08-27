// cv plugin — turns a folder of Markdown CVs into one published résumé page.
//
// Every file in content/cv/ is a *variant* (a CV tuned for a role, a market, a
// language); exactly one is live, chosen with the "activeVariant" option in the
// admin's Plugins screen. The page is built at build time — plain HTML that
// prints to a clean PDF and works with JavaScript off. client.js only adds the
// print button, client.css only styles what's already there.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The site root — plugins/cv/index.js is always two folders below it. Derived
// from this file rather than the working directory so the build can run from
// anywhere.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// The variant schema. The admin renders its edit form from exactly this list,
// so a field added here is a field you can fill in the browser.
const FIELDS = [
  { name: 'title', type: 'text', required: true }, // the variant's own name, e.g. "AI engineer"
  { name: 'name', type: 'text' },                  // the person — the page's <h1>
  { name: 'role', type: 'text' },
  { name: 'summary', type: 'textarea' },
  { name: 'photo', type: 'image' },
  { name: 'contact', type: 'list' },
  { name: 'metrics', type: 'list' },
  { name: 'pdf', type: 'text' },
  { name: 'description', type: 'text' },
  { name: 'date', type: 'date' }, // optional: when this CV was last revised — the page's sitemap lastmod
  { name: 'draft', type: 'boolean', default: false },
];

export default {
  /**
   * Declare the CV collection so variants are scanned, validated and editable
   * in the admin — unless the site already defines one under that name, which
   * always wins. The folder is created when missing: a collection whose path
   * doesn't exist stops the build, and a plugin can't commit files, so a
   * freshly installed plugin would otherwise break the site until someone
   * added a file by hand. The plugin creates the *folder* only; everything in
   * it is written by you.
   */
  init(site, options) {
    const name = collection(options);
    if (site.config.collections[name]) return;
    const dir = `content/${name}`;
    fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
    site.config.collections[name] = {
      path: dir,
      render: false, // no page of its own per variant — this plugin publishes the active one
      label: options.label || 'CV',
      sortBy: 'slug',
      sortOrder: 'asc',
      pageSize: 50,
      fields: FIELDS,
    };
  },

  /**
   * Publish the active variant at options.url, and (optionally) every other
   * variant at a private link under it. Written in afterBuild so the page is a
   * real file in dist/, listed in sitemap.xml and the search index like any
   * other page.
   */
  afterBuild(distPath, site, options) {
    const name = collection(options);
    const variants = site.collections[name] || [];
    if (!variants.length) {
      return warn(`no CV variants yet — add one under "${options.label || 'CV'}" in the admin, or create content/${name}/default.md`);
    }

    const active = pickActive(variants, options.activeVariant, name);
    const url = normalizeUrl(options.url);
    const publish = (variant, at, indexed) => {
      const target = path.join(distPath, at.slice(1), 'index.html');
      if (fs.existsSync(target)) {
        return warn(`${at} is already a page on this site — the CV was not published there. Delete that page, or point the plugin's "url" option somewhere else.`);
      }
      let html = site.renderPage('page', { page: pageContext(variant, at, site) });
      html = stripThemeHeading(html);
      if (!indexed) html = html.replace('</head>', '<meta name="robots" content="noindex">\n</head>');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, html);
      if (indexed) {
        addToSitemap(distPath, site.config.site.url + at, variant.date);
        addToSearchIndex(distPath, variant, at);
      }
    };

    publish(active, url, true);
    if (options.publishAllVariants) {
      // Share links, not competing pages: every other variant gets a URL of its
      // own but stays out of the sitemap and out of search engines.
      for (const variant of variants) if (variant !== active) publish(variant, `${url}${variant.slug}/`, false);
    }
  },
};

const collection = (options) => options.collection || 'cv';
const warn = (message) => console.log(`  ⚠ cv: ${message}`);

/** The variant named in the settings; the only one when there's only one; else the first, loudly. */
function pickActive(variants, activeVariant, name) {
  const wanted = String(activeVariant || '').trim().replace(/\.md$/, '');
  const found = variants.find((v) => v.slug === wanted);
  if (found) return found;
  const available = variants.map((v) => v.slug).join(', ');
  if (wanted) warn(`no variant named "${wanted}" — publishing "${variants[0].slug}" instead. Available: ${available}. (Set "activeVariant" under Plugins → CV → Configure.)`);
  else if (variants.length > 1) warn(`"activeVariant" isn't set — publishing "${variants[0].slug}". Available: ${available}.`);
  return variants[0];
}

/** The template context for one variant: the CV is the page's content. */
function pageContext(variant, url, site) {
  const person = variant.name || variant.title || site.config.site.title;
  return {
    title: person,
    description: variant.description || variant.summary || '',
    url,
    content: cvHtml(variant, person),
    // Themes that print a cover or lede on pages get nothing to print.
    cover: null,
  };
}

/** The whole CV as HTML: identity header, metrics strip, then the Markdown body. */
function cvHtml(variant, person) {
  const parts = [];
  parts.push(`<div class="plain-cv" data-cv-variant="${esc(variant.slug)}">`);
  parts.push('<header class="cv-header">');
  if (variant.photo) parts.push(`<img class="cv-photo" src="${esc(variant.photo)}" alt="${esc(person)}">`);
  parts.push('<div class="cv-identity">');
  parts.push(`<h1 class="cv-name">${esc(person)}</h1>`);
  if (variant.role) parts.push(`<p class="cv-role">${esc(variant.role)}</p>`);
  if (variant.summary) parts.push(`<p class="cv-summary">${esc(variant.summary)}</p>`);
  const contacts = list(variant.contact).map((entry) => `<li>${contactHtml(entry)}</li>`);
  // A linked PDF is a real link, so it works without JavaScript; without one,
  // client.js adds a print button here instead (and nothing at all if JS is off).
  if (variant.pdf) contacts.push(`<li class="cv-action"><a class="cv-pdf" href="${esc(variant.pdf)}" download>Download PDF</a></li>`);
  if (contacts.length) parts.push(`<ul class="cv-contact">${contacts.join('')}</ul>`);
  parts.push('</div></header>');

  const metrics = list(variant.metrics).map((metric) => {
    const [value, label] = splitOnce(String(metric), '|');
    return `<div class="cv-metric"><span class="cv-metric-value">${esc(value)}</span>${label ? `<span class="cv-metric-label">${esc(label)}</span>` : ''}</div>`;
  });
  if (metrics.length) parts.push(`<div class="cv-metrics">${metrics.join('')}</div>`);

  parts.push(`<div class="cv-body">\n${markMeta(variant.content || '')}\n</div>`);
  parts.push('</div>');
  return parts.join('\n');
}

/**
 * The italic line right under a role heading ("*2021–2023 | Zurich*") is the
 * entry's dates and place — tag it so CSS can set it apart from body text.
 */
function markMeta(html) {
  return html.replace(/(<\/h([34])>\s*)<p><em>([\s\S]*?)<\/em><\/p>/gi, (m, head, level, inner) => `${head}<p class="cv-meta">${inner}</p>`);
}

/** One contact entry: a Markdown link, an email, a URL, or plain text. */
function contactHtml(entry) {
  const text = String(entry).trim();
  const link = text.match(/^\[([^\]]+)\]\((\S+)\)$/);
  if (link) return `<a href="${esc(link[2])}">${esc(link[1])}</a>`;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text)) return `<a href="mailto:${esc(text)}">${esc(text)}</a>`;
  if (/^https?:\/\/\S+$/i.test(text)) return `<a href="${esc(text)}">${esc(text.replace(/^https?:\/\//i, '').replace(/\/$/, ''))}</a>`;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(text)) return `<a href="https://${esc(text)}">${esc(text)}</a>`;
  return esc(text);
}

/**
 * Drop the theme's page heading — the CV brings its own <h1> with the photo and
 * contact details, and two page titles would be one too many. The block to
 * remove is the last <header>…</header> holding an <h1> between the start of
 * the page's content and the CV: every shipped theme wraps a page title that
 * way, right above the content it belongs to. The search starts at <main> (or
 * <article>) so the site's own masthead is out of reach; a theme that opens
 * neither, or titles its pages without a <header>, simply keeps its heading.
 */
function stripThemeHeading(html) {
  const at = html.indexOf('<div class="plain-cv"');
  if (at === -1) return html;
  const before = html.slice(0, at);
  const from = Math.max(before.toLowerCase().lastIndexOf('<main'), before.toLowerCase().lastIndexOf('<article'));
  if (from === -1) return html;
  let last = null;
  for (const match of before.slice(from).matchAll(/<header\b[^>]*>[\s\S]*?<\/header>/gi)) {
    if (/<h1\b/i.test(match[0])) last = match;
  }
  return last ? html.slice(0, from + last.index) + html.slice(from + last.index + last[0].length) : html;
}

/** Add the published CV to sitemap.xml, where the build's own pages already are. */
function addToSitemap(distPath, loc, lastmod) {
  const file = path.join(distPath, 'sitemap.xml');
  if (!fs.existsSync(file)) return;
  const entry = `  <url><loc>${escXml(loc)}</loc>${lastmod ? `<lastmod>${escXml(lastmod)}</lastmod>` : ''}</url>\n`;
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('</urlset>', `${entry}</urlset>`));
}

/** Same for search-index.json, so the search plugin can find the CV. */
function addToSearchIndex(distPath, variant, url) {
  const file = path.join(distPath, 'search-index.json');
  if (!fs.existsSync(file)) return;
  let entries;
  try { entries = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return; }
  if (!Array.isArray(entries)) return;
  entries.push({
    url,
    title: variant.name || variant.title,
    description: variant.description || variant.summary || '',
    tags: [],
    text: stripHtml(`${variant.summary || ''} ${variant.content || ''}`).slice(0, 2000),
  });
  fs.writeFileSync(file, JSON.stringify(entries) + '\n');
}

const list = (value) => (Array.isArray(value) ? value : []).filter((entry) => String(entry).trim() !== '');

function splitOnce(text, separator) {
  const at = text.indexOf(separator);
  return at === -1 ? [text.trim(), ''] : [text.slice(0, at).trim(), text.slice(at + 1).trim()];
}

/** "/resume" and "resume/" both mean /resume/. */
function normalizeUrl(url) {
  const clean = String(url || '/resume/').trim().replace(/^\/*/, '/').replace(/\/*$/, '/');
  return clean === '/' ? '/resume/' : clean;
}

const stripHtml = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const escXml = (s) => esc(s).replace(/'/g, '&apos;');
