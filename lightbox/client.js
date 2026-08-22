// lightbox plugin — click-to-zoom for content images. Clicking an image opens a
// fullscreen dialog showing it large, with its alt text as a caption and
// prev/next navigation. Pure progressive enhancement: with JavaScript off,
// nothing changes — images render exactly as the theme laid them out.

const opts = JSON.parse(document.getElementById('plugin-options')?.textContent || '{}');
const cfg = opts.lightbox || {};
const captions = cfg.captions !== false;

// Candidates: images matching the selector, except linked images (never hijack
// a link) and anything explicitly opted out with class="no-lightbox".
const DEFAULT_SELECTOR = 'article img, main img';
let matched;
try {
  matched = document.querySelectorAll(cfg.selector || DEFAULT_SELECTOR);
} catch {
  console.warn(`lightbox: invalid selector ${JSON.stringify(cfg.selector)}; using default`);
  matched = document.querySelectorAll(DEFAULT_SELECTOR);
}
const images = [...matched]
  .filter((img) => !img.closest('a') && !img.classList.contains('no-lightbox'));

for (const [i, img] of images.entries()) {
  img.classList.add('pl-zoomable');
  img.setAttribute('role', 'button');
  img.setAttribute('tabindex', '0'); // keyboard users can focus and open too
  if (!img.alt) img.setAttribute('aria-label', 'View image');
  img.addEventListener('click', () => open(i));
  img.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); }
  });
}

let overlay = null;
let current = 0;
let opener = null;
let prevOverflow = '';

function open(index) {
  opener = images[index];

  overlay = el('div', 'plain-lightbox');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Image viewer');

  const figure = el('figure', 'pl-figure');
  figure.append(el('img', 'pl-img'), el('figcaption', 'pl-caption'));

  const closeButton = button('pl-close', 'Close', '×');
  overlay.append(figure, closeButton);
  if (images.length > 1) {
    overlay.append(button('pl-prev', 'Previous image', '‹'), button('pl-next', 'Next image', '›'));
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target === figure) hide();
    else if (e.target.closest('.pl-close')) hide();
    else if (e.target.closest('.pl-prev')) show(current - 1);
    else if (e.target.closest('.pl-next')) show(current + 1);
  });
  document.addEventListener('keydown', onKey);

  document.body.append(overlay);
  prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden'; // lock scroll while open
  show(index);
  closeButton.focus();
}

function show(index) {
  current = (index + images.length) % images.length;
  const source = images[current];
  const big = overlay.querySelector('.pl-img');
  big.src = source.currentSrc || source.src;
  const caption = overlay.querySelector('.pl-caption');
  caption.textContent = captions ? source.alt : '';
  caption.hidden = !caption.textContent;
  // When the caption is visible it carries the description — blank the zoomed
  // image's alt so screen readers don't announce the same text twice.
  big.alt = caption.hidden ? source.alt : '';
}

function hide() {
  document.removeEventListener('keydown', onKey);
  overlay.remove();
  overlay = null;
  document.body.style.overflow = prevOverflow;
  opener?.focus();
}

function onKey(e) {
  if (e.key === 'Escape') hide();
  else if (e.key === 'ArrowLeft') show(current - 1);
  else if (e.key === 'ArrowRight') show(current + 1);
  else if (e.key === 'Tab') trap(e);
}

// Minimal focus trap: keep Tab cycling between the dialog's buttons.
function trap(e) {
  const buttons = [...overlay.querySelectorAll('button')];
  const first = buttons[0];
  const last = buttons[buttons.length - 1];
  if (!overlay.contains(document.activeElement)) { first.focus(); e.preventDefault(); }
  else if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
  else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function button(className, label, glyph) {
  const b = el('button', className);
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.textContent = glyph;
  return b;
}
