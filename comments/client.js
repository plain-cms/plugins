// comments plugin — GitHub-Discussions-backed comments via the giscus embed
// (loads the third-party https://giscus.app/client.js). Appends a comment
// section after the article on post pages. Pure progressive enhancement — with
// JavaScript off (or repo/repoId unconfigured) nothing renders.

const opts = JSON.parse(document.getElementById('plugin-options')?.textContent || '{}');
const cfg = opts.comments || {};

const configured = cfg.repo && cfg.repoId;
const onPath = !cfg.pathPrefix || location.pathname.startsWith(cfg.pathPrefix);
if (configured && onPath) mount();

function mount() {
  // By default mount only where an <article> exists (post/page, not lists).
  // When a pathPrefix opted this page in, fall back to <main>.
  const article = document.querySelector('article');
  const host = article || (cfg.pathPrefix ? document.querySelector('main') : null);
  if (!host) return;

  const section = document.createElement('section');
  section.className = 'plain-comments';

  const script = document.createElement('script');
  script.src = 'https://giscus.app/client.js';
  script.async = true;
  script.crossOrigin = 'anonymous';
  const data = {
    repo: cfg.repo,
    'repo-id': cfg.repoId,
    mapping: cfg.mapping || 'pathname',
    strict: '0',
    'reactions-enabled': cfg.reactionsEnabled === false ? '0' : '1',
    'emit-metadata': '0',
    'input-position': 'bottom',
    theme: 'preferred_color_scheme',
    lang: cfg.lang || 'en',
    loading: 'lazy',
  };
  if (cfg.category) data.category = cfg.category;
  if (cfg.categoryId) data['category-id'] = cfg.categoryId;
  for (const [key, value] of Object.entries(data)) script.setAttribute(`data-${key}`, value);

  section.append(script);
  host.append(section);
}
