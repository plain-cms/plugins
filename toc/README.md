# toc

Build-time table of contents. On every content page (posts and static pages), the
plugin scans the rendered HTML for `<h2>`–`<h{depth}>` headings, links them into a
nested list, and injects a `<nav class="plain-toc" aria-label="Table of contents">`
immediately after the page title's `</h1>` (or at the top of the `<article>` if the
theme has no h1). Everything happens during the build — the published page is plain
static HTML plus a small stylesheet, so the TOC works with JavaScript disabled.

Headings rendered from Markdown already carry `id` attributes (plain adds them);
the plugin reuses those. Headings that lack an id (e.g. raw HTML in content) get a
slug id generated from their text, deduplicated with `-2`, `-3`… suffixes. Pages
with fewer than `minHeadings` matching headings are left untouched, as are list,
tag, pagination, and 404 pages.

No network calls, at build time or in the browser.

## Usage

Add `"toc"` to `plugins` in your site config. Nothing else is required — the TOC
appears on any post or page with enough headings. Override defaults via
`pluginOptions.toc`, e.g.:

```json
{
  "plugins": ["toc"],
  "pluginOptions": { "toc": { "minHeadings": 4, "depth": 2, "heading": "On this page" } }
}
```

Set `"heading": ""` to omit the label above the list.

## Options

| Option | Default | Meaning |
| ------ | ------- | ------- |
| `minHeadings` | `3` | Minimum number of collected headings before a TOC is injected; below this the page is left unchanged. |
| `depth` | `3` | Deepest heading level included, from h2 down to h`depth` (clamped to 2–6). |
| `heading` | `"Contents"` | Label shown above the list; empty string renders the list with no label. |
