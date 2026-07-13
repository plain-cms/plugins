# github-stars

Live GitHub star counts, as progressive enhancement. Mark any element with
`data-gh-stars="owner/repo"` and put the last-known count inside it as the fallback:

```html
<span data-gh-stars="plain-cms/plain">★ 7</span>
```

On load, the plugin replaces the number with the live count from `api.github.com` (cached in
`localStorage` for `ttlHours`, default 12), preserving any `★` prefix. With JavaScript off, the baked
number shows. Any failure (offline, rate-limited, 404) leaves the baked number in place.

## Options

| Option | Default | Meaning |
| ------ | ------- | ------- |
| `ttlHours` | `12` | How long to cache each repo's count in the browser. |
