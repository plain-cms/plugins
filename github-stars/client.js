// github-stars — progressive enhancement: replace the baked-in star counts on
// [data-gh-stars="owner/repo"] elements with live counts from the GitHub API.
// The baked number is the fallback, so the page is correct with JavaScript off.
// Counts are cached in localStorage (per repo) to respect GitHub's rate limit,
// and any failure (offline, rate-limited, 404) leaves the baked number in place.

const options = JSON.parse(document.getElementById('plugin-options')?.textContent || '{}')['github-stars'] || {};
const ttl = (Number(options.ttlHours) || 12) * 3600e3;
const els = document.querySelectorAll('[data-gh-stars]');

if (els.length) {
  const repos = [...new Set([...els].map((el) => el.dataset.ghStars).filter(Boolean))];
  Promise.all(repos.map((repo) => stars(repo))).then((counts) => {
    const byRepo = new Map(repos.map((repo, i) => [repo, counts[i]]));
    for (const el of els) {
      const n = byRepo.get(el.dataset.ghStars);
      if (typeof n !== 'number') continue; // fetch failed → keep the baked value
      const live = n.toLocaleString('en-US');
      // Swap just the number, preserving any "★ " prefix and surrounding text.
      el.textContent = /\d/.test(el.textContent)
        ? el.textContent.replace(/\d[\d,]*/, live)
        : `${el.textContent} ${live}`.trim();
    }
  });
}

// Current stargazer count for one "owner/repo", cached in localStorage for `ttl` ms.
async function stars(repo) {
  const key = `gh-stars:${repo}`;
  try {
    const hit = JSON.parse(localStorage.getItem(key) || 'null');
    if (hit && typeof hit.n === 'number' && Date.now() - hit.t < ttl) return hit.n;
  } catch { /* ignore unparsable / unavailable storage */ }
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    const n = (await res.json()).stargazers_count;
    if (typeof n !== 'number') return null;
    try { localStorage.setItem(key, JSON.stringify({ n, t: Date.now() })); } catch { /* storage full/blocked */ }
    return n;
  } catch {
    return null;
  }
}
