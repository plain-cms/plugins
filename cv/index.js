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
  { name: 'header', type: 'boolean', default: true }, // false when the body brings its own header markup
  { name: 'stylesheet', type: 'text' }, // optional: a CSS file to link on this CV's page
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
   * When the active CV is an existing page of the site, that page is also the
   * CV's source — two addresses, one document. Point search engines at the CV
   * and leave the original reachable but unindexed. Opt out with
   * "hideSource": false.
   */
  renderPage(page, html, site, options) {
    if (options.hideSource === false || !page?.url) return html;
    const active = pickActive(site.collections[collection(options)] || [], options.activeVariant, site, collection(options), true);
    if (!active?.url || active.url !== page.url) return html;
    const url = site.config.site.url + normalizeUrl(options.url);
    const canonical = `<link rel="canonical" href="${esc(url)}">`;
    html = /<link rel="canonical"[^>]*>/i.test(html)
      ? html.replace(/<link rel="canonical"[^>]*>/i, canonical)
      : html.replace('</head>', `${canonical}\n</head>`);
    return html.replace('</head>', '<meta name="robots" content="noindex, follow">\n</head>');
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
    const active = pickActive(variants, options.activeVariant, site, name);
    if (!active) return;
    const url = normalizeUrl(options.url);
    const publish = (variant, at, indexed) => {
      const target = path.join(distPath, at.slice(1), 'index.html');
      if (fs.existsSync(target)) {
        return warn(`${at} is already a page on this site — the CV was not published there. Delete that page, or point the plugin's "url" option somewhere else.`);
      }
      const person = personOf(variant, site);
      const content = cvHtml(variant, person, name);
      let html = site.renderPage('page', { page: pageContext(variant, at, person, content) });
      // Only when the CV supplies a heading of its own — a variant that opted
      // out of the built-in header and doesn't provide one keeps the theme's.
      if (/<h1\b/i.test(content)) html = stripThemeHeading(html);
      // Last in <head>, so a design's own rules settle ties with the theme and
      // with this plugin's stylesheet. One file can dress every variant.
      if (variant.stylesheet) {
        html = html.replace('</head>', `<link rel="stylesheet" href="${esc(withBasePath(variant.stylesheet, site))}">\n</head>`);
      }
      if (!indexed) html = html.replace('</head>', '<meta name="robots" content="noindex">\n</head>');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, html);
      if (indexed) {
        addToSitemap(distPath, site.config.site.url + at, variant.date);
        addToSearchIndex(distPath, variant, at);
        // A page borrowed from another collection is published twice: here,
        // and at its own address. Leave one of them for search engines.
        if (variant.url && variant.url !== at && options.hideSource !== false) {
          removeFromSitemap(distPath, site.config.site.url + variant.url);
        }
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

/** Root-relative URLs need the site's basePath — the build already rewrote the
 *  page's own by the time a plugin adds one. */
function withBasePath(url, site) {
  const base = String(site.config.site.basePath || '').replace(/\/+$/, '');
  return base && url.startsWith('/') && !url.startsWith('//') ? base + url : url;
}
const warn = (message) => console.log(`  ⚠ cv: ${message}`);

/**
 * The active CV. Usually a variant in the CV collection, named by its filename;
 * "<collection>/<slug>" borrows any other item on the site — a hand-built page
 * that is a CV without following this plugin's shape. Null when there's nothing
 * to publish. `quiet` suppresses the warnings for the per-page hook, which asks
 * the same question on every page of the site.
 */
function pickActive(variants, activeVariant, site, name, quiet = false) {
  const wanted = String(activeVariant || '').trim().replace(/\.md$/, '');
  const say = (message) => { if (!quiet) warn(message); };
  const available = variants.map((v) => v.slug).join(', ');

  if (wanted.includes('/')) {
    const [from, ...rest] = wanted.split('/');
    const slug = rest.join('/');
    const borrowed = (site.collections[from] || []).find((item) => item.slug === slug);
    if (borrowed) return borrowed;
    say(`"${wanted}" isn't a page on this site — no item "${slug}" in the "${from}" collection.${variants.length ? ` Publishing "${variants[0].slug}" instead.` : ''}`);
    return variants[0] || null;
  }

  if (!variants.length) {
    say(`no CV to publish — add a variant in the admin, create content/${name}/default.md, or point "activeVariant" at a page you already have, as "pages/<slug>".`);
    return null;
  }
  const found = variants.find((v) => v.slug === wanted);
  if (found) return found;
  if (wanted) say(`no variant named "${wanted}" — publishing "${variants[0].slug}" instead. Available: ${available}. (Set "activeVariant" under Plugins → CV → Configure.)`);
  else if (variants.length > 1) say(`"activeVariant" isn't set — publishing "${variants[0].slug}". Available: ${available}.`);
  return variants[0];
}

const personOf = (variant, site) => variant.name || variant.title || site.config.site.title;

/** The template context for one variant: the CV is the page's content. */
function pageContext(variant, url, person, content) {
  // The <h1> is the CV's own, so page.title is only the browser tab and the
  // link preview — worth the job title as well as the name. A role line tends
  // to run "Senior Engineer — Backend · C# · Azure"; only the part before the
  // first separator is the job title, and the rest would bloat the tab.
  const headline = String(variant.role || '').split(/\s[—–·|]\s/)[0].trim();
  return {
    title: headline ? `${person} — ${headline}` : person,
    description: variant.description || variant.summary || '',
    url,
    content,
    // Themes that print a cover or lede on pages get nothing to print.
    cover: null,
  };
}

/** The whole CV as HTML: identity header, metrics strip, then the Markdown body. */
function cvHtml(variant, person, cvCollection) {
  const parts = [];
  parts.push(`<div class="plain-cv" data-cv-variant="${esc(variant.slug)}">`);
  // A variant whose body is its own design ("header": false) still fills in
  // name and role — they're the browser tab and the link preview — but the
  // plugin stays out of the way and renders no header of its own. A page
  // borrowed from elsewhere on the site is its own design by definition, so
  // it opts in rather than out.
  const header = variant.header === undefined ? variant.collection === cvCollection : variant.header !== false;
  if (header) parts.push(headerHtml(variant, person));
  const metrics = list(variant.metrics).map((metric) => {
    const [value, label] = splitOnce(String(metric), '|');
    return `<div class="cv-metric"><span class="cv-metric-value">${esc(value)}</span>${label ? `<span class="cv-metric-label">${esc(label)}</span>` : ''}</div>`;
  });
  if (metrics.length) parts.push(`<div class="cv-metrics">${metrics.join('')}</div>`);

  parts.push(`<div class="cv-body">\n${bindPdf(markMeta(variant.content || ''), variant.pdf)}\n</div>`);
  parts.push('</div>');
  return parts.join('\n');
}

/**
 * Point every <a data-cv-pdf> in the body at this variant's "pdf" file, so
 * hand-written markup gets the download link of whichever CV is live. Without
 * a pdf the link would go nowhere, so it's dropped instead.
 */
function bindPdf(html, pdf) {
  return html.replace(/<a\b([^>]*\bdata-cv-pdf\b[^>]*)>([\s\S]*?)<\/a>/gi, (tag, attrs, label) => {
    if (!pdf) return '';
    const rest = attrs.replace(/\s*\bhref\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/\s*\bdownload\b(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, '');
    return `<a href="${esc(pdf)}" download${rest}>${label}</a>`;
  });
}

/** Photo, name, role, summary and contacts — the CV's own page heading. */
function headerHtml(variant, person) {
  const parts = ['<header class="cv-header">'];
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

/** Drop one URL from sitemap.xml — the borrowed page the CV now stands in for. */
function removeFromSitemap(distPath, loc) {
  const file = path.join(distPath, 'sitemap.xml');
  if (!fs.existsSync(file)) return;
  const xml = fs.readFileSync(file, 'utf8');
  const entry = new RegExp(`^ *<url><loc>${escXml(loc).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>.*$\n?`, 'm');
  if (entry.test(xml)) fs.writeFileSync(file, xml.replace(entry, ''));
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
