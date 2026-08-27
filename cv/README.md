# cv

A CV / résumé page built from Markdown — with as many **variants** as you need and
exactly one of them live. Keep a general CV, an AI-roles CV and a German-market CV
side by side in your repo, then switch which one the world sees from the admin's
**Plugins → CV → Configure** screen. Publishing is a config change, not a rewrite.

The page is generated at build time: static HTML, styled with your theme's own
colours and spacing, correct with JavaScript disabled, and laid out to print
straight to a clean two-page PDF.

## Quick start

1. Install the plugin. It creates `content/cv/`, an empty **CV** collection that
   shows up in the admin sidebar — one Markdown file per variant.
2. Add your first variant: **CV → New** in the admin, or copy this plugin's
   [`example.md`](example.md) to `content/cv/default.md` and edit it.
3. Visit `/resume/`. With one variant there's nothing to configure.
4. Add more variants whenever you need one (`content/cv/ai-engineer.md`), then set
   **activeVariant** to the filename without `.md` to make it the live one.

Non-active variants are not published — they exist in your repo and nowhere else,
unless you turn on `publishAllVariants`.

## Writing a variant

Frontmatter carries the header; the Markdown body is the CV itself.

```markdown
---
title: AI engineer            # this variant's name in the admin (required)
name: Alex Rivera             # the person — the page's <h1> and <title>
role: Senior Backend Engineer — Go · Postgres · AWS
summary: One or two sentences that say what you do and for whom.
description: Meta description for search results and link previews.
photo: /media/profile.jpg
contact:
  - alex@example.com                                    # becomes a mailto: link
  - github.com/alexrivera                               # becomes https://
  - "[LinkedIn](https://linkedin.com/in/alexrivera)"    # a labelled link
  - Lisbon, Portugal · EU citizen                       # plain text stays plain
metrics:
  - 12 yrs | in production      # "value | label" — rendered as a metrics strip
  - 40k rps | peak traffic
pdf: /media/alex-rivera-cv.pdf  # optional: a real file to download, instead of
                                # the print button
date: 2026-08-01                # optional: last revised — the page's sitemap lastmod
header: true                    # false when the body brings its own header markup
draft: false
---

## About

Prose.

## Experience

### Northwind Payments — Staff Engineer
*2021–Present | Lisbon*

- What you did, with a number in it.
```

Rules worth knowing:

- **`## headings` are the CV's sections** — name them whatever you like. They're
  set off with a rule; `###` is a role or a project inside one.
- **The italic line under a `###`** (`*2021–Present | Lisbon*`) is treated as that
  entry's dates and place, and styled apart from the body text.
- **The page's `<title>`** is "name — role", shortened to the part of the role
  before its first separator (`Senior Engineer — Backend · Go` becomes
  `Alex Rivera — Senior Engineer`). The `<h1>` on the page is the name alone.
- **`draft: true`** hides a variant from the build entirely, active or not.
- A variant is **never** published at its own URL unless `publishAllVariants` is on.

### Building blocks

The stylesheet ships a few extra pieces for the parts of a CV that aren't prose.
Write them as HTML anywhere in the body (leave a blank line before and after, so
the Markdown around them still renders):

| Markup | What it gives you |
| ------ | ----------------- |
| `<table class="cv-skills"><tr><th>Backend</th><td>Go · Python</td></tr></table>` | A skills matrix: labelled rows that wrap on a phone |
| `<div class="cv-cards"><div class="cv-card">…</div></div>` | Project cards: an icon, then a `<div class="cv-card-body">` with a heading (`<span class="cv-kicker">` for the aside in it), a line of prose, and a `<p class="cv-facts">` |
| `<ul class="cv-pills"><li><a class="cv-pill" href="…"><strong>repo</strong> <span>what it is</span></a></li></ul>` | A compact strip of links — open-source repos, talks, certifications |
| `<ul class="cv-grid"><li><a class="cv-tile" href="…"><div class="cv-tile-text"><strong>Name</strong><span>One line</span></div></a></li></ul>` | A tiled grid of smaller projects |
| `<ul class="cv-dated"><li><a href="…">Title</a><time>March 2026</time></li></ul>` | A list with dates aligned to the right — writing, talks |
| `<p class="cv-note">…</p>` | The closing availability note |
| `<div class="cv-web-only">…</div>` | Shown on the page, dropped from the printed PDF |
| `<div class="cv-print-only">…</div>` | The reverse — only appears in print |

Icons are either an `<img>` or a `<span class="cv-icon" style="background-image: url('…')">`
— both size themselves to the block they're in. `<span class="cv-icon cv-icon--letter">B</span>`
draws a lettered tile for a project with no logo.

`cv-web-only` is how a web CV stays richer than a paper one: put the project
cards and the writing list in it, and the PDF stays the lean two pages a
recruiter expects. The photo and the download button are dropped in print too.

### Variants that bring their own design

A CV can be a design in its own right rather than a page in your theme's clothes.
Set **`header: false`** and the plugin renders no header of its own — `name` and
`role` still fill in the browser tab and the link preview, but the body's markup
is the whole page, and the theme's page title is left alone unless that markup
has an `<h1>` of its own. Style it from a `<style>` block in the body, or from a
stylesheet the site already serves; the plugin only asks that the CV lives inside
the `.plain-cv` wrapper it provides.

Such a page usually wants its own colours on paper too. The print sheet sets its
ink palette on `:root`, so re-declaring the same custom properties under
`@media print` in the page's own (later) stylesheet takes precedence:

```css
@media print {
  :root:root { --color-accent: #b68235; --color-text: #201f1d; }
}
```

## Options

| Option | Default | Meaning |
| ------ | ------- | ------- |
| `activeVariant` | `""` | Filename (without `.md`) of the variant to publish. Empty is fine when there's only one; with several, the build warns and publishes the first alphabetically. |
| `url` | `/resume/` | Where the CV is published. |
| `collection` | `cv` | Collection name — variants live in `content/<collection>/`. |
| `label` | `CV` | What the collection is called in the admin sidebar. |
| `printButton` | `true` | Add a "Download PDF" button that opens the browser's print dialog. |
| `printButtonLabel` | `Download PDF` | Its wording. |
| `publishAllVariants` | `false` | Also publish every other variant at `<url><variant>/` as an unlisted page (`noindex`, kept out of the sitemap) — handy for sending one person a tailored link. |

A variant with a `pdf:` field gets a real download link instead of the print
button, so that variant needs no JavaScript at all.

## What it does to your site

- **Creates `content/<collection>/` if it's missing** and registers it as a
  data-only collection, so variants are editable in the admin. If your
  `site.config.json` already defines a collection with that name, yours is used
  as-is and nothing is created.
- **Writes one page** (plus one per variant if `publishAllVariants` is on) into
  `dist/` after the build, and adds the live one to `sitemap.xml` and
  `search-index.json`.
- **Never overwrites an existing page.** If something else already publishes
  `url` — a `content/pages/resume.md`, say — the plugin leaves it alone and says
  so in the build log. Delete that page, or point `url` elsewhere.
- **Removes the theme's page title block** on the CV page only: the CV brings its
  own `<h1>` with the photo and contact details next to it.

No network calls at build time or in the browser. The only client JavaScript is
the print button.

## Moving an existing résumé page in

If you already have a hand-built `content/pages/resume.md`:

1. Move its body to `content/cv/default.md` and lift the header (name, role,
   summary, photo, contact lines) into frontmatter.
2. Delete the inline `<style>` block — this plugin's stylesheet covers it — and
   rename any custom classes to the building blocks above.
3. Delete `content/pages/resume.md`, so `/resume/` is free for the plugin.
