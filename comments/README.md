# comments

Comments backed by GitHub Discussions, via the [giscus](https://giscus.app) embed. On pages that
contain an `<article>`, the plugin appends a `<section class="plain-comments">` at the end of the
article and mounts the giscus widget inside it. Visitors sign in with GitHub to comment; each page
maps to a discussion in your repo (by pathname, by default).

Client-only progressive enhancement: with JavaScript disabled — or until `repo` and `repoId` are
configured — nothing renders and the page is unaffected.

**Third-party network call:** when configured, every matching page loads
`https://giscus.app/client.js`, which embeds an iframe from giscus.app and talks to the GitHub API
on the visitor's behalf.

## Setup

1. Use a **public** GitHub repo with **Discussions enabled** and the
   [giscus app](https://github.com/apps/giscus) installed.
2. Open [giscus.app](https://giscus.app), enter your repo, and copy the generated `data-repo-id`
   and `data-category-id` values.
3. Set the options in your site config:

```json
"pluginOptions": {
  "comments": {
    "repo": "you/your-repo",
    "repoId": "R_kgDO...",
    "category": "Comments",
    "categoryId": "DIC_kwDO..."
  }
}
```

## Options

| Option | Default | Meaning |
| ------ | ------- | ------- |
| `repo` | `""` | GitHub repo in `owner/name` form. Required — the widget stays hidden without it. |
| `repoId` | `""` | The repo's giscus id (`data-repo-id` from giscus.app). Required. |
| `category` | `""` | Discussion category name for new comment threads. |
| `categoryId` | `""` | The category's giscus id (`data-category-id` from giscus.app). |
| `mapping` | `"pathname"` | How pages map to discussions (`pathname`, `url`, `title`, `og:title`). |
| `reactionsEnabled` | `true` | Show reactions for the main discussion post. |
| `lang` | `"en"` | Widget language. |
| `pathPrefix` | `""` | Only mount on paths starting with this prefix (e.g. `/posts/`). Empty = any page with an `<article>`. Matched against `location.pathname`, so on sites deployed under a `basePath` include it in the prefix (e.g. `/plain/posts/`). |
