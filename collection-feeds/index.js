// collection-feeds plugin — build-time "what's next" and "what's new" lists
// from your collections, handed to every page in the page's own language.
//
// A feed is a named view of one collection:
//   mode "upcoming"  events sorted by date: the next N, the next recurring
//                    meeting, every upcoming and every past item.
//   mode "latest"    posts newest first: the latest N and all of them.
//
// init():             reads each feed's collection folder (default language and
//                     every translation) before the engine scans content and
//                     builds the feeds once per language. Items are translated
//                     where a translation exists, else the default language —
//                     the same rule the engine uses for list pages.
// transformContent(): every item of the `attachTo` collections (default: pages)
//                     gets `page.feeds.<name>` in its language; every item of a
//                     feed collection gets `isUpcoming` / `isPast`, `weekday`,
//                     `typeLabel` and `listUrl`.
//
// "Today" is the build date in `timeZone`. A static site only knows the date it
// was built, so rebuild on a schedule (see README) or pin `today` (YYYY-MM-DD)
// for a reproducible build. No network calls, no client JavaScript.

import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter, urlFor } from '../../lib/content.js';
import { formatDate, isIsoDate } from '../../lib/util.js';
import { activeLanguages, splitLangSuffix } from '../../lib/i18n.js';

const MODES = ['upcoming', 'latest'];

/** Per-language feed results, filled by init(): { [lang]: { [feedName]: result } }. */
let byLang = {};
/** Normalised feed specs in config order, filled by init(). */
let feeds = [];
/** site.locales from the config: the date locale per language, e.g. { en: 'en-GB' }. */
let locales = {};

export default {
  init(site, options) {
    byLang = {};
    locales = site.config.site.locales || {};
    feeds = normaliseFeeds(options, site.config.collections);
    if (!feeds.length) return;

    const { defaultLang, languages, suffixes } = siteLanguages(site);
    const today = todayIso(options);

    for (const lang of languages) byLang[lang] = {};
    for (const feed of feeds) {
      const def = site.config.collections[feed.collection];
      const versions = readCollection(def, suffixes, defaultLang);
      for (const lang of languages) {
        const items = localisedItems(versions, def, feed, lang, defaultLang).filter((item) => passesFilter(feed, item.type));
        byLang[lang][feed.name] = feed.mode === 'upcoming'
          ? upcomingFeed(items, feed, today, lang, defaultLang)
          : latestFeed(items, feed, lang, defaultLang);
      }
    }
    // Default-language results for list and tag pages, which render in the
    // default language only: {{ data.collectionFeeds.<name>.next }}.
    site.data.collectionFeeds = byLang[defaultLang];
  },

  transformContent(item, site, options) {
    if (!feeds.length) return;
    const { defaultLang } = siteLanguages(site);
    const lang = item.language || defaultLang;

    const attachTo = Array.isArray(options.attachTo) ? options.attachTo : ['pages'];
    if (attachTo.includes(item.collection)) item.feeds = byLang[lang] || byLang[defaultLang];

    // Every feed whose collection and type filter match lists the item in
    // `inFeed` ({{#if page.inFeed.news}}); the first one in config order
    // decides the item's flags — so one collection split by type into an
    // "events" feed and a "news" feed gives each item the right ones.
    const matching = feeds.filter((f) => f.collection === item.collection && passesFilter(f, item[f.typeField]));
    if (!matching.length) return;
    item.inFeed = Object.fromEntries(matching.map((f) => [f.name, true]));
    const feed = matching[0];
    const today = byLang[lang]?.[feed.name]?.today || todayIso(options);
    if (feed.mode === 'upcoming' && isIsoDate(item[feed.dateField])) {
      item.isPast = item[feed.dateField] < today;
      item.isUpcoming = !item.isPast;
    }
    if (isIsoDate(item[feed.dateField])) item.weekday = weekday(item[feed.dateField], dateLocale(lang));
    if (item[feed.typeField] !== undefined) item.typeLabel = typeLabel(feed, item[feed.typeField], lang);
    const listUrl = listUrlFor(feed, site.config.collections[feed.collection], lang, defaultLang);
    if (listUrl) item.listUrl = listUrl;
  },
};

/** Validate and fill in each feed spec. Errors name the option to fix. */
function normaliseFeeds(options, collections) {
  const specs = options.feeds && typeof options.feeds === 'object' ? options.feeds : {};
  return Object.entries(specs).map(([name, spec]) => {
    const where = `pluginOptions.collection-feeds.feeds.${name}`;
    if (!spec || typeof spec !== 'object') throw new Error(`collection-feeds: ${where} must be an object like { "collection": "posts", "mode": "latest" }`);
    const collection = spec.collection || name;
    if (!collections[collection]) throw new Error(`collection-feeds: ${where} names collection "${collection}", which is not in site.config.json — set ${where}.collection to one of: ${Object.keys(collections).join(', ')}`);
    const mode = spec.mode || 'latest';
    if (!MODES.includes(mode)) throw new Error(`collection-feeds: ${where}.mode is "${mode}" — use "upcoming" (events, soonest first) or "latest" (posts, newest first)`);
    const limit = Number(spec.limit);
    return {
      name,
      collection,
      mode,
      limit: Number.isInteger(limit) && limit > 0 ? limit : 3,
      dateField: spec.dateField || 'date',
      typeField: spec.typeField || 'type',
      recurringType: spec.recurringType || '',
      includeTypes: Array.isArray(spec.includeTypes) ? spec.includeTypes : [],
      excludeTypes: Array.isArray(spec.excludeTypes) ? spec.excludeTypes : [],
      listPage: spec.listPage || '',
      typeLabels: { ...(options.typeLabels || {}), ...(spec.typeLabels || {}) },
    };
  });
}

/** The languages to build feeds for, and the suffix list the engine splits
    filenames with (empty on a monolingual site, so "notes.en.md" stays a slug). */
function siteLanguages(site) {
  const defaultLang = site.config.site.language || 'en';
  const active = activeLanguages(site.config.site);
  return { defaultLang, languages: active.length ? active : [defaultLang], suffixes: active };
}

function todayIso(options) {
  if (isIsoDate(options.today)) return options.today;
  // sv-SE formats as YYYY-MM-DD; the time zone decides when "today" rolls over.
  return new Date().toLocaleDateString('sv-SE', { timeZone: options.timeZone || 'UTC' });
}

/** The locale dates are written in: site.locales[lang] when set, else the
 * language code itself — the engine's own rule (plain 1.21+), repeated here so
 * the plugin also runs on older engines. */
function dateLocale(lang) {
  return locales[lang] || lang;
}

function weekday(isoDate, language) {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(language, { weekday: 'long', timeZone: 'UTC' });
}

function typeLabel(feed, type, lang) {
  return feed.typeLabels?.[lang]?.[type] ?? type;
}

function passesFilter(feed, type) {
  if (feed.includeTypes.length && !feed.includeTypes.includes(type)) return false;
  if (feed.excludeTypes.includes(type)) return false;
  return true;
}

/** The visible list page for a feed, localised; else the collection's own list URL. */
function listUrlFor(feed, def, lang, defaultLang) {
  if (feed.listPage) return lang === defaultLang ? feed.listPage : `/${lang}${feed.listPage}`;
  return def.listUrl || null;
}

/** Read one collection folder: slug → { <lang>: frontmatter }. */
function readCollection(def, suffixes, defaultLang) {
  const bySlug = new Map();
  const dir = path.resolve(process.cwd(), def.path);
  if (!fs.existsSync(dir)) return bySlug;
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.md')) continue;
    const { base, lang } = splitLangSuffix(file.slice(0, -3), suffixes);
    const { data } = parseFrontmatter(fs.readFileSync(path.join(dir, file), 'utf8'), path.join(def.path, file));
    if (!bySlug.has(base)) bySlug.set(base, {});
    bySlug.get(base)[lang || defaultLang] = data;
  }
  return bySlug;
}

/**
 * One language's view of a collection: the translation where one exists, else
 * the original. Date and type always come from the original so a translation
 * can never sort or filter differently from the page it translates. Drafts and
 * items without a valid date are left out, as the engine leaves them out.
 */
function localisedItems(bySlug, def, feed, lang, defaultLang) {
  const items = [];
  for (const [slug, versions] of bySlug) {
    const original = versions[defaultLang];
    if (!original || original.draft || !isIsoDate(original[feed.dateField])) continue;
    const translated = lang !== defaultLang && versions[lang] && !versions[lang].draft;
    const data = translated ? versions[lang] : original;
    const url = urlFor(def.urlPattern, slug);
    const date = original[feed.dateField];
    const type = original[feed.typeField];
    // Same membership flags the collection item gets in transformContent, so
    // one card partial serves both a feed list and the collection loop.
    const inFeed = Object.fromEntries(feeds.filter((f) => f.collection === feed.collection && passesFilter(f, type)).map((f) => [f.name, true]));
    items.push({
      ...data,
      slug,
      collection: feed.collection,
      url: url && translated ? `/${lang}${url}` : url,
      date,
      type,
      inFeed,
      typeLabel: type === undefined ? undefined : typeLabel(feed, type, lang),
      dateFormatted: formatDate(date, dateLocale(lang)),
      weekday: weekday(date, dateLocale(lang)),
    });
  }
  return items;
}

function upcomingFeed(items, feed, today, lang, defaultLang) {
  items.sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug));
  for (const item of items) {
    item.isPast = item.date < today;
    item.isUpcoming = !item.isPast;
  }
  const upcoming = items.filter((item) => item.isUpcoming);
  const past = items.filter((item) => item.isPast).reverse();
  return {
    mode: 'upcoming',
    today,
    next: upcoming.slice(0, feed.limit),
    nextRecurring: feed.recurringType ? upcoming.find((item) => item.type === feed.recurringType) || null : null,
    upcoming,
    past,
    hasUpcoming: upcoming.length > 0,
    hasPast: past.length > 0,
    hasMore: upcoming.length > feed.limit,
    listUrl: listUrlFor(feed, { listUrl: null }, lang, defaultLang),
  };
}

function latestFeed(items, feed, lang, defaultLang) {
  items.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  return {
    mode: 'latest',
    latest: items.slice(0, feed.limit),
    all: items,
    hasAny: items.length > 0,
    hasMore: items.length > feed.limit,
    listUrl: listUrlFor(feed, { listUrl: null }, lang, defaultLang),
  };
}
