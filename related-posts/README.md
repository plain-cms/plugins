# related-posts

Adds a "Related posts" section to every page of a collection at build time — no client JavaScript. For each post, every other post in the same collection is scored: +2 for each shared tag, +1 for each shared title word longer than 3 characters (lowercased); ties go to the newer post. The top `count` matches are injected before the post's closing `</article>` (falling back to `</main>`; pages with neither are left untouched). Posts with no positive-score match get no section at all.

Injected markup:

```html
<section class="related-posts">
  <h2>Related posts</h2>
  <ul>
    <li><a href="/posts/other-post/">Other post</a> <time class="rp-date" datetime="2026-01-05">January 5, 2026</time></li>
  </ul>
</section>
```

`client.css` styles the section from the theme's own colors (border-top separator, muted heading, plain list) — it introduces no explicit colors, so it is dark-mode safe without overrides.

Runs entirely in the site build. No network calls, no data collection.

## Options

| Option | Default | Meaning |
| ------ | ------- | ------- |
| `collection` | `"posts"` | The collection whose pages get the section — and whose posts are the candidates. |
| `count` | `3` | Maximum number of related posts listed. |
| `heading` | `"Related posts"` | Text of the section's `<h2>`. |
