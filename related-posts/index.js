// related-posts plugin — at build time, appends a "Related posts" section to
// every page of a collection: the other posts are scored by shared tags and
// title words and the best matches are injected as plain HTML before the
// article closes. Zero client JavaScript — client.css only styles the section.

const TAG_POINTS = 2;
const WORD_POINTS = 1;

export default {
  renderPage(page, html, site, options) {
    const collection = options.collection || 'posts';
    if (!page || page.collection !== collection) return html;

    const items = (site.collections && site.collections[collection]) || [];
    const pageTags = tagSet(page.tags);
    const pageWords = titleWords(page.title);

    // Translated pages are not the same object as (and have a different URL
    // than) their default-language original, but share its slug — compare
    // slugs too so a translation never recommends its own article.
    const related = items
      .filter((item) => item !== page && item.url && item.url !== page.url && item.slug !== page.slug && !item.draft)
      .map((item) => {
        let score = 0;
        for (const tag of tagSet(item.tags)) if (pageTags.has(tag)) score += TAG_POINTS;
        for (const word of titleWords(item.title)) if (pageWords.has(word)) score += WORD_POINTS;
        return { item, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || timestamp(b.item) - timestamp(a.item))
      .slice(0, maxCount(options.count));

    if (!related.length) return html;

    // renderPage runs after basePath rewriting, so inserted URLs must carry it.
    const basePath = String((site.config && site.config.site && site.config.site.basePath) || '').replace(/\/+$/, '');
    const list = related.map(({ item }) => {
      const link = `<a href="${esc(basePath + item.url)}">${esc(item.title || item.slug || item.url)}</a>`;
      const when = item.date
        ? ` <time class="rp-date" datetime="${esc(item.date)}">${esc(item.dateFormatted || item.date)}</time>`
        : '';
      return `<li>${link}${when}</li>`;
    }).join('');
    const section = `<section class="related-posts"><h2>${esc(options.heading || 'Related posts')}</h2><ul>${list}</ul></section>`;

    return insertBefore(html, '</article>', section) ?? insertBefore(html, '</main>', section) ?? html;
  },
};

function tagSet(tags) {
  return new Set((Array.isArray(tags) ? tags : []).map((tag) => String(tag).toLowerCase()));
}

function titleWords(title) {
  return new Set(String(title || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 3));
}

function timestamp(item) {
  const time = Date.parse(item.date);
  return Number.isNaN(time) ? 0 : time;
}

function maxCount(count) {
  const n = Number(count);
  return Number.isInteger(n) && n > 0 ? n : 3;
}

// Insert `section` before the LAST occurrence of `closer` (a closing tag,
// matched case-insensitively); null when the tag isn't in the document.
// Scans with a regex rather than indexing into html.toLowerCase(): lowercasing
// can change string length (e.g. "İ" becomes two code units), which would
// shift the index and corrupt the output.
function insertBefore(html, closer, section) {
  const re = new RegExp(closer, 'gi'); // closers are literal tags with no regex metacharacters
  let at = -1;
  for (let m; (m = re.exec(html)) !== null; ) at = m.index;
  return at === -1 ? null : html.slice(0, at) + section + html.slice(at);
}

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
