# plain plugins

A **curated registry** of optional plugins for the [plain](https://github.com/plain-cms/plain) CMS.
Browse and install them from your site's admin (**Plugins** screen) — no code, no servers. Installing
copies the plugin folder into your repo and enables it in `site.config.json`, as one commit.

Plugins are **executable code** — some run at build time (in your CI, with repo access), some in your
visitors' browsers — so every plugin listed here is reviewed before it ships. See
[CONTRIBUTING.md](CONTRIBUTING.md) to submit one.

## Plugins

| Plugin | Runs | What it does |
| ------ | ---- | ------------ |
| [github-stars](github-stars/) | client | Live GitHub star counts on any `[data-gh-stars]` element. |
| [comments](comments/) | client | GitHub-Discussions-backed comments on your posts via the giscus embed. |
| [related-posts](related-posts/) | build | Related-articles section under each post, scored by shared tags and title words. |
| [toc](toc/) | build | Table of contents from each page's headings, injected after the title. |
| [lightbox](lightbox/) | client | Click-to-zoom fullscreen viewer for content images with alt-text captions. |
| [cv](cv/) | both | Makes any page your live CV — switchable, with a PDF download button and a print-clean stylesheet. |
| [collection-feeds](collection-feeds/) | build | Next events and latest posts per page, in the page's language — upcoming/past split, next recurring meeting, type labels. |

## How install works

The admin reads `registry.json`, copies the chosen plugin's folder into your repo's `plugins/<id>/`,
and adds `<id>` to the `plugins` array in `site.config.json` — one commit. Uninstalling reverses both.
