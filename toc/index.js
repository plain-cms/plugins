// toc plugin — builds a table of contents from each content page's headings at
// build time and injects it right after the page title. The result is plain
// static HTML plus a small stylesheet: no client JavaScript, so the TOC works
// identically with JS disabled.

// Matches real heading open/close tag pairs. Safe to run over the whole page:
// marked escapes code blocks, so a literal "<h2" inside <pre><code> is emitted
// as "&lt;h2" and can never match as an actual tag.
const HEADING = /<h([2-6])\b([^>]*)>([\s\S]*?)<\/h\1\s*>/gi;

export default {
  renderPage(page, html, site, options) {
    // Content-item pages only (list/tag/pagination/404 pages have no
    // `collection`); idempotency guard in case the hook ever sees its own output.
    if (!page || !page.collection) return html;
    if (html.includes('class="plain-toc"')) return html;

    const depth = Math.min(Math.max(Number(options.depth) || 3, 2), 6);
    const minHeadings = Number(options.minHeadings) >= 0 ? Number(options.minHeadings) : 3;

    // Scope to the first <article> when the theme has one, else the whole page.
    // (Non-greedy: with nested <article>s only the first would be covered —
    // neither shipped theme nests them.)
    const article = html.match(/<article\b[^>]*>[\s\S]*?<\/article>/i);
    let scope = article ? article[0] : html;

    // Seed used ids with every id already in scope so generated slugs never
    // collide with the ids marked already stamps on markdown headings. Matches
    // double-quoted, single-quoted, and unquoted attribute values; over-seeding
    // (e.g. from data-id) is harmless — it only skips a slug.
    const used = new Set();
    for (const m of scope.matchAll(/\bid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"'=]+))/gi)) {
      used.add(m[1] ?? m[2] ?? m[3]);
    }

    const headings = [];
    scope = scope.replace(HEADING, (tag, level, attrs, inner) => {
      if (Number(level) > depth) return tag;
      const text = decodeEntities(inner.replace(/<[^>]*>/g, '')).trim();
      // Any quoting style counts as "has an id" — never rewrite such a heading,
      // or browsers would keep the author's (first) id and break our anchor.
      const idAttr = attrs.match(/(?:^|\s)id\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"'=]+))/i);
      const id = idAttr ? (idAttr[1] ?? idAttr[2] ?? idAttr[3]) : uniqueSlug(text, used);
      headings.push({ level: Number(level), id, text });
      return idAttr ? tag : `<h${level}${attrs} id="${id}">${inner}</h${level}>`;
    });

    // Also bail on an empty list (possible with minHeadings 0): injecting an
    // empty <ol> would be wrong, and listHtml requires a non-empty array.
    if (!headings.length || headings.length < minHeadings) return html;

    const label = options.heading === undefined ? 'Contents' : options.heading;
    const nav = `<nav class="plain-toc" aria-label="Table of contents">` +
      (label ? `<strong>${esc(label)}</strong>` : '') + listHtml(headings) + `</nav>`;

    // Insert right after the page title's </h1>; a theme without one gets the
    // TOC at the very start of the article. No h1 and no article: leave the
    // page alone.
    if (/<\/h1\s*>/i.test(scope)) {
      scope = scope.replace(/<\/h1\s*>/i, (m) => `${m}\n${nav}`);
    } else if (article) {
      scope = scope.replace(/<article\b[^>]*>/i, (m) => `${m}\n${nav}`);
    } else {
      return html;
    }

    if (!article) return scope;
    return html.slice(0, article.index) + scope + html.slice(article.index + article[0].length);
  },
};

// Nested <ol> markup from a flat heading list; levels may skip or start deep.
function listHtml(headings) {
  const base = Math.min(...headings.map((h) => h.level));
  let out = '';
  let level = base - 1;
  for (const h of headings) {
    const target = Math.max(h.level, base);
    if (level < target) {
      while (level < target) { out += '<ol><li>'; level += 1; }
    } else {
      while (level > target) { out += '</li></ol>'; level -= 1; }
      out += '</li><li>';
    }
    out += `<a href="#${h.id}">${esc(h.text)}</a>`;
  }
  while (level >= base) { out += '</li></ol>'; level -= 1; }
  return out;
}

// Same shape as plain's own heading ids: lowercase alphanumerics + hyphens,
// "section" fallback, numeric suffixes on duplicates.
function uniqueSlug(text, used) {
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
  let id = slug;
  for (let n = 2; used.has(id); n += 1) id = `${slug}-${n}`;
  used.add(id);
  return id;
}

function decodeEntities(s) {
  return s.replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[e]));
}

// Mirrors marked's escaping: an "&" that already starts a valid entity
// reference (&mdash;, &#8212;, &#x2014;…) is passed through so it still renders
// as the character, instead of being double-escaped into literal "&mdash;".
function esc(s) {
  return String(s)
    .replace(/&(?!(?:#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
