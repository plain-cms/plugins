# collection-feeds

Build-time lists from your collections for the homepage and sidebars: **the next three
events**, **the next club night**, **the latest two posts**. Each list is a *feed* — a named
view of one collection — and every page receives the feeds as `page.feeds.<name>`, already
in the page's own language. Nothing runs in the browser; the published page is plain HTML.

Why a plugin: a template can loop `collections.events`, but it cannot say "only the ones
from today on, soonest first, at most three", and it cannot find "the next item of type
*Club night*". The plugin computes those once per build and hands them to the templates.

Runs entirely in the site build. No network calls, no data collection. Imports the engine's
own `lib/content.js`, `lib/util.js` and `lib/i18n.js`, so it reads frontmatter and translated
filenames exactly as the build does.

## Usage

Add `"collection-feeds"` to `plugins` and name at least one feed:

```json
{
  "plugins": ["collection-feeds"],
  "pluginOptions": {
    "collection-feeds": {
      "timeZone": "Europe/Zurich",
      "feeds": {
        "events": { "collection": "events", "mode": "upcoming", "limit": 3, "recurringType": "Club night", "listPage": "/events/" },
        "news":   { "collection": "posts",  "mode": "latest",   "limit": 2, "listPage": "/blog/" }
      }
    }
  }
}
```

Then, in a page template such as `home.html`:

```html
{{#if page.feeds.events.nextRecurring}}
  <p>Next club night: <a href="{{ page.feeds.events.nextRecurring.url }}">
    {{ page.feeds.events.nextRecurring.weekday }}, {{ page.feeds.events.nextRecurring.dateFormatted }}</a></p>
{{/if}}

<h2>Upcoming</h2>
<ul>{{#each page.feeds.events.next as item}}
  <li><a href="{{ item.url }}">{{ item.title }}</a> — {{ item.dateFormatted }}{{#if item.typeLabel}} · {{ item.typeLabel }}{{/if}}</li>
{{/each}}</ul>

<h2>Latest posts</h2>
<ul>{{#each page.feeds.news.latest as item}}
  <li><a href="{{ item.url }}">{{ item.title }}</a></li>
{{/each}}</ul>
```

A full events page that shows upcoming dates first and past ones as an archive — and exists
in every language, which a collection's own list page does not — is a page with
`template: events` whose template loops the collection and uses the item flags:

```html
{{#if page.feeds.events.hasUpcoming}}
  <h2>Upcoming</h2>
  <ul>{{#each collections.events as item}}{{#if item.isUpcoming}}<li>…</li>{{/if}}{{/each}}</ul>
{{/if}}
{{#if page.feeds.events.hasPast}}
  <h2>Past</h2>
  <ul>{{#each collections.events as item}}{{#if item.isPast}}<li>…</li>{{/if}}{{/each}}</ul>
{{/if}}
```

### Keeping "today" current

A static site only knows the date it was built. Rebuild on a schedule so past events move
to the archive by themselves — one small workflow next to `build-deploy.yml`:

```yaml
# .github/workflows/rebuild-weekly.yml
name: Rebuild weekly
on:
  schedule:
    - cron: '0 3 * * 1'   # Mondays 03:00 UTC
  workflow_dispatch:
jobs:
  rebuild:
    runs-on: ubuntu-latest
    permissions: { actions: write }
    steps:
      - run: gh workflow run build-deploy.yml -R "$GITHUB_REPOSITORY"
        env: { GH_TOKEN: ${{ secrets.GITHUB_TOKEN }} }
```

GitHub pauses scheduled workflows after 60 days without a commit; "Run workflow" or any
commit turns them back on.

Set `today` (YYYY-MM-DD) to pin the date — for a reproducible build or a test fixture.

## What a feed contains

Every item in a feed is the item's frontmatter plus:

| Field | Meaning |
| ----- | ------- |
| `url` | The item's URL, localised (`/fr/events/…/` on a French page when a translation exists). |
| `slug`, `collection` | As in the engine. |
| `date`, `type` | Read from the **original** (default-language) file, so a translation never sorts or filters differently. |
| `dateFormatted` | The date in the page's language, as the engine formats it — in the locale set in `site.locales` when there is one (`{ "en": "en-GB" }` gives "20 November 2026"). |
| `weekday` | The weekday name in the page's language (`"Donnerstag"`). |
| `typeLabel` | The type translated via `typeLabels`, else the type value itself. |
| `inFeed` | `{ "<feed name>": true }` for every feed the item belongs to. |
| `isUpcoming`, `isPast` | Mode `upcoming` only. |

The same fields are set on the collection's own items (next section), so one card partial
works inside `{{#each page.feeds.events.next as item}}` and inside `{{#each collections.events as item}}`.

Mode **`upcoming`** (events; sorted by date, soonest first):

| Field | Meaning |
| ----- | ------- |
| `next` | The next `limit` items dated today or later. |
| `nextRecurring` | The first upcoming item whose type equals `recurringType`, or `null`. |
| `upcoming`, `past` | Every upcoming item (soonest first) and every past one (most recent first). |
| `hasUpcoming`, `hasPast`, `hasMore` | Booleans for `{{#if}}`; `hasMore` is true when more than `limit` items are upcoming. |
| `today` | The build date used, `YYYY-MM-DD`. |
| `listUrl` | `listPage` localised, if set. |

Mode **`latest`** (posts; newest first):

| Field | Meaning |
| ----- | ------- |
| `latest` | The newest `limit` items. |
| `all` | Every item, newest first. |
| `hasAny`, `hasMore` | Booleans for `{{#if}}`. |
| `listUrl` | `listPage` localised, if set. |

Drafts and items whose date field is not a valid `YYYY-MM-DD` are left out, as the engine
leaves them out. On a multilingual site, every feed is computed once per language and each
item is the translation where one exists, else the original — the same rule the engine uses
for list pages. Default-language results are also available to list and tag pages (which
render in the default language only) as `data.collectionFeeds.<name>`.

## What items of a feed collection receive

Every item of a collection that a feed reads gets, in its own language:

| Field | Meaning |
| ----- | ------- |
| `inFeed` | `{ "<feed name>": true }` for every feed the item belongs to — `{{#if page.inFeed.news}}` picks a layout per feed. |
| `isUpcoming`, `isPast` | Mode `upcoming` only: dated today or later / before today. |
| `weekday` | Weekday name of the item's date. |
| `typeLabel` | Translated type, else the type value. |
| `listUrl` | The feed's `listPage`, localised; else the collection's own `listUrl`. |

When two feeds read the same collection (an events feed and a news feed split by type, see
below), the first feed in config order whose type filter matches the item sets its fields.

## Options

Top level (`pluginOptions.collection-feeds`):

| Option | Default | Meaning |
| ------ | ------- | ------- |
| `feeds` | `{}` | Named feed specs, see below. Required: with no feeds the plugin does nothing. |
| `attachTo` | `["pages"]` | Collections whose items receive `page.feeds`. |
| `timeZone` | `"UTC"` | IANA time zone that decides when "today" rolls over (`"Europe/Berlin"`). |
| `today` | `""` | Pin the build date, `YYYY-MM-DD`. Empty = the real date. |
| `typeLabels` | `{}` | `{ "<lang>": { "<type value>": "<label>" } }` shared by all feeds; a feed's own `typeLabels` win per key. |

Per feed (`feeds.<name>`):

| Option | Default | Meaning |
| ------ | ------- | ------- |
| `collection` | the feed's name | Which collection to read; must exist in `collections`. |
| `mode` | `"latest"` | `"upcoming"` (events, soonest first, split at today) or `"latest"` (newest first). |
| `limit` | `3` | Length of `next` / `latest`. |
| `dateField` | `"date"` | The frontmatter field holding the `YYYY-MM-DD` date. |
| `typeField` | `"type"` | The frontmatter field holding the item's type (usually a `select` field). |
| `recurringType` | `""` | Mode `upcoming`: the type value of the recurring meeting, for `nextRecurring` (`"Club night"`, `"Stammtisch"`). |
| `includeTypes` | `[]` | Only items whose type is in this list. |
| `excludeTypes` | `[]` | Skip items whose type is in this list. |
| `listPage` | `""` | URL of the visible list page (`"/events/"`), localised per language into `listUrl`. |
| `typeLabels` | `{}` | Per-feed `{ "<lang>": { "<type>": "<label>" } }`, merged over the top-level map. |

### One collection, two feeds

A club that keeps news posts and events in a single collection (one `type` select with
`News` among the event types) gets both lists from it:

```json
"feeds": {
  "news":   { "collection": "updates", "mode": "latest",   "limit": 2, "includeTypes": ["News"] },
  "events": { "collection": "updates", "mode": "upcoming", "limit": 3, "excludeTypes": ["News"], "recurringType": "Club night" }
}
```

A post dated today is a post, not a date: because the `news` feed comes first and matches
`News` items, those never receive `isUpcoming`.

### Errors

A feed that names a missing collection, or an unknown `mode`, stops the build with a message
that names the option to fix (`pluginOptions.collection-feeds.feeds.events.collection …`).
