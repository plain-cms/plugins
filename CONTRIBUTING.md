# Contributing a plugin

Plugins here are **curated**: each is reviewed before listing, because a plugin runs code on other
people's sites. Open a PR that adds one folder plus a `registry.json` entry.

## Checklist

- [ ] One folder `your-plugin/` with a valid `plugin.json` (`name`, `version`, `description` required; `name` matches the folder).
- [ ] **Vanilla JS only** — no npm dependencies, no bundler, no TypeScript. (plain ships exactly one runtime dep: `marked`.)
- [ ] **Works with JavaScript disabled** — `client.js` is progressive enhancement; the page must be correct without it.
- [ ] Client code reads options from `JSON.parse(document.getElementById('plugin-options').textContent)['your-plugin']`.
- [ ] No obfuscated/minified code, no telemetry, no data exfiltration. Any third-party network call is disclosed in the plugin's `README.md`.
- [ ] A `README.md` documenting usage and every option.
- [ ] A `registry.json` entry: `{ id, title, category, description, runsAt, author }` where `runsAt` is `client`, `build`, or `both`.
- [ ] `runsAt` is honest — `build` means your `index.js` runs in the installing site's CI with write access to its repo.

`node tools/validate.mjs` must pass (CI runs it on every PR).
