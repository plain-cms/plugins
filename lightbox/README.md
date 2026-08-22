# lightbox

Click-to-zoom for content images, as pure progressive enhancement. Every image matching
the `selector` option gets a zoom-in cursor; clicking it opens a fullscreen dialog
(dark backdrop, image at up to 92vw × 92vh) with the image's alt text as a caption.
With JavaScript off, nothing changes — images render exactly as the theme laid them out.

Markup the plugin looks at:

- Images inside an `<a>` are skipped — links are never hijacked.
- Add `class="no-lightbox"` to any image to opt it out.
- Captions come from the image's `alt` attribute (empty alt = no caption).

Candidate images are focusable — Enter or Space opens the viewer from the keyboard.
In the dialog: Esc or clicking the backdrop closes, ArrowLeft/ArrowRight (or the
prev/next buttons, shown when more than one image is on the page) navigate, body
scroll is locked while open, and focus returns to the clicked image on close. The
open transition is disabled under `prefers-reduced-motion: reduce`. No network
requests are made; the viewer reuses the images already on the page.

## Options

| Option | Default | Meaning |
| ------ | ------- | ------- |
| `selector` | `"article img, main img"` | CSS selector for candidate images (linked and `.no-lightbox` images are always excluded). An invalid selector falls back to the default with a console warning. |
| `captions` | `true` | Show the image's alt text as a caption under the zoomed image. |
