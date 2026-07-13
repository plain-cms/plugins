// your-plugin — runs as a module on every page. MUST be progressive enhancement:
// the page has to be correct with JavaScript disabled. Read options from the
// injected JSON tag (keyed by your plugin name):
const options = JSON.parse(document.getElementById('plugin-options')?.textContent || '{}')['your-plugin'] || {};

// ... enhance the page here ...
