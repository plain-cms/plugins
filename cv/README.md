# cv

Your CV is a page you wrote. This plugin decides **which page is the live one**,
publishes it at a stable address, attaches a PDF to its download button, and
keeps the CVs you aren't using out of search results.

There is no CV format to fill in and no structure to follow. Write the page any
way you like — plain Markdown, your own HTML, your own stylesheet — and point the
plugin at it. Switching to a different CV is one setting, so the URL you put on
an application never changes while what it shows does.

## Quick start

1. Write the page: **New page** in the admin, or a file in `content/pages/`.
   Want a CV-shaped starting point? Copy [`sample-cv.md`](sample-cv.md) from this
   folder to `content/pages/` and edit it. Skip it and write your own — nothing
   here depends on it.
2. In the admin: **Plugins → CV → Configure**, set **`page`** to that page —
   `pages/resume`, or just `resume`.
3. It's live at `/resume/`. Change `url` to publish it somewhere else, or clear
   `url` to leave the CV at its own address and let the plugin do the rest.

To switch CVs later, write another page and change `page`. Mark every page that
is a CV with `cv: true` in its frontmatter and the ones you aren't using stay
reachable but unindexed — a shelf of CVs with one on the wall.

## The download button

Set **`pdf`** to a file the site serves and the button becomes a real download
link. Where it goes is up to you:

- **Anywhere you want it** — put `data-cv-download` on a link in your page and
  that link *is* the button, keeping your own markup and classes:
  ```html
  <a class="my-button" data-cv-download>Download CV</a>
  ```
  The build fills in its `href` and `download`.
- **Or let the plugin place it** — with no such link in the page,
  `buttonPosition` puts one under the page title (`top`), at the end
  (`bottom`), or nowhere at all (`none`).

**With no PDF attached**, the same button prints the page instead — the browser's
own "save as PDF" is one dialog away. That needs JavaScript, so it stays hidden
until it's wired up, and never sits there dead.

**Uploading a PDF:** the admin's **Media** screen takes any file under 5 MB.
Upload it there, use *Copy path*, and paste `/media/2026/08/your-cv.pdf` into the
`pdf` setting. A file committed to the repo works the same — any path the site
serves is a valid value.

A single page can also carry its own `pdf:` in frontmatter, which wins over the
setting. That's how two CVs ship two different PDFs.

## Options

| Option | Default | Meaning |
| ------ | ------- | ------- |
| `page` | `""` | The page that is your CV: `pages/resume`, `resume`, or `/resume-2026/`. |
| `url` | `/resume/` | Where it's published. Empty leaves the CV at its own address. |
| `pdf` | `""` | The download file. A page's own `pdf:` frontmatter overrides it. |
| `buttonLabel` | `Download CV` | Wording, when the plugin places the button itself. |
| `buttonPosition` | `top` | `top`, `bottom` or `none`. Ignored when the page has a `data-cv-download` link of its own. |
| `hideOthers` | `true` | Point the CV's source page — and any other page marked `cv: true` — at the live CV: `noindex, follow`, canonical to it, dropped from the sitemap. |

## Frontmatter a CV page may use

All optional; a CV page is a normal page and needs none of them.

| Key | Meaning |
| --- | ------- |
| `cv: true` | Marks the page as one of your CVs — listed in the build's warnings, and unindexed while it isn't the live one. |
| `pdf:` | This CV's own download file. |
| `stylesheet:` | A CSS file to link on the published CV — handy when several CVs share one design. |

## Styling (optional)

The plugin marks the CV's page `<body data-cv>` and ships a stylesheet keyed to
it. None of it is imposed: it's a set of classes to use if you want them, all
drawn from your theme's own colours and spacing, and `sample-cv.md` shows each
one in place.

| Class | What it gives you |
| ----- | ----------------- |
| `cv-body` | Wrap your content in it for CV typography — sectioned `h2` rules, tighter lists |
| `cv-header`, `cv-photo`, `cv-identity`, `cv-role`, `cv-summary`, `cv-contact` | The identity block: photo beside name, role, and a row of contact links |
| `cv-metrics` + `cv-metric` / `cv-metric-value` / `cv-metric-label` | A strip of numbers worth leading with |
| `cv-skills` | A skills table: labelled rows that wrap on a phone |
| `cv-meta` | The dates-and-place line under a role heading |
| `cv-cards` / `cv-card`, `cv-pills` / `cv-pill`, `cv-grid` / `cv-tile`, `cv-dated`, `cv-note` | Projects, links, tiles, dated lists, the closing note |
| `cv-web-only` / `cv-print-only` | Shown on the page but not in print, and the reverse |

**Printing.** The CV page prints as a clean document: site chrome dropped, ink
palette, `cv-web-only` sections removed, page breaks kept off headings. A page
with its own design can override any of it — the palette is set on `:root`, so
re-declaring those custom properties under `@media print` in your own (later)
stylesheet wins.

## What it does to your site

- Publishes one page's HTML at `url`, and adds that address to `sitemap.xml` and
  `search-index.json`.
- Never overwrites an existing page: if something already publishes `url`, the
  plugin says so in the build log and leaves it alone.
- Marks the CV's own `<body>` with `data-cv`, adds the download button, and
  (unless `hideOthers` is off) points duplicate copies at the live one.

No network calls at build time or in the browser. The only client JavaScript is
the print fallback.

## Upgrading from 1.x

1.x kept CVs in a `content/cv/` collection with a schema of its own — name,
role, contacts, metrics as frontmatter. 2.0 drops all of it: move those files
into `content/pages/`, write the header as markup in the page (see
`sample-cv.md`), and replace `activeVariant` with `page`. `publishAllVariants`,
`collection`, `label`, `header` and `printButton` are gone; `pdf`,
`stylesheet` and `data-cv-pdf` still work, the last as a synonym of
`data-cv-download`.
