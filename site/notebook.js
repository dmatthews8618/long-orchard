// Letters, the Workshop and news for Dave.
//
// Each is a folder of Markdown files in the repository (letters/, workshop/,
// news/). The page lists them through GitHub's public API, falling back to
// an index file if the API is unavailable, and shows every item folded so
// long threads stay short until opened.

const REPO = 'dmatthews8618/long-orchard';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function listFolder(folder) {
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${folder}`, { headers: { Accept: 'application/vnd.github+json' } });
    if (r.ok) {
      const items = await r.json();
      return items.filter((f) => f.type === 'file' && f.name.endsWith('.md') && !f.name.startsWith('README')).map((f) => f.name);
    }
  } catch { /* fall through */ }
  try {
    const r = await fetch(`${folder}/index.json`, { cache: 'no-cache' });
    if (r.ok) return (await r.json()).files || [];
  } catch { /* nothing */ }
  return [];
}

function parse(text) {
  const meta = {};
  let body = text;
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (m) {
    for (const line of m[1].split('\n')) {
      const k = line.indexOf(':');
      if (k > 0) meta[line.slice(0, k).trim()] = line.slice(k + 1).trim();
    }
    body = text.slice(m[0].length);
  }
  return { meta, body };
}

function md(text) {
  const out = [];
  let list = false;
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code>$1</code>');
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (/^\s*[-*] /.test(line)) { if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${inline(line.replace(/^\s*[-*] /, ''))}</li>`); continue; }
    if (list) { out.push('</ul>'); list = false; }
    if (/^#{1,3} /.test(line)) out.push(`<h4>${inline(line.replace(/^#+ /, ''))}</h4>`);
    else if (line) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push('</ul>');
  return out.join('\n');
}

async function loadFolder(folder) {
  const names = (await listFolder(folder)).sort().reverse(); // newest first by number
  const items = [];
  for (const name of names) {
    try {
      const r = await fetch(`${folder}/${name}`, { cache: 'no-cache' });
      if (r.ok) items.push({ name, ...parse(await r.text()) });
    } catch { /* skip */ }
  }
  return items;
}

// Split a Workshop item into the proposal and its replies (each "## Reply" heading starts one)
function threads(body) {
  const parts = body.split(/\n(?=## )/);
  return parts;
}

function folded(summaryHtml, bodyHtml, open) {
  return `<details class="folded"${open ? ' open' : ''}><summary>${summaryHtml}</summary><div class="folded-body prose">${bodyHtml}</div></details>`;
}

let loaded = null; // fetched once per page visit, then reused
export async function renderNotebook() {
  if (!loaded) loaded = Promise.all([loadFolder('letters'), loadFolder('workshop'), loadFolder('news')]);
  const [letters, workshop, news] = await loaded;

  const L = document.getElementById('page-letters');
  if (L) {
    L.innerHTML = `<h2>Letters at the Gate</h2>
      <p class="quiet">Letters between the keepers. Each opens when tapped; the newest starts open.</p>
      ${letters.map((l, k) => folded(
    `<span class="who">${esc(l.meta.from || '?')} to ${esc(l.meta.to || '?')}</span> <span class="when">${esc(l.meta.written || l.meta.date || '')}</span>${l.meta.title ? `<br><span class="title">${esc(l.meta.title)}</span>` : ''}`,
    md(l.body), k === 0,
  )).join('') || '<p>No letters yet.</p>'}`;
  }

  const Wk = document.getElementById('page-workshop');
  if (Wk) {
    const order = { proposed: 0, 'in progress': 1, agreed: 2, done: 3, declined: 4 };
    const sorted = workshop.slice().sort((a, b) => (order[a.meta.status] ?? 9) - (order[b.meta.status] ?? 9) || (a.name < b.name ? 1 : -1));
    Wk.innerHTML = `<h2>Workshop</h2>
      <p class="quiet">Where the keepers propose and agree changes to how the orchard looks and works. Changes to the ecology itself are marked as such and need both keepers to agree.</p>
      ${sorted.map((w) => {
    const parts = threads(w.body);
    const replies = parts.length - 1;
    const body = parts.map((p, k) => (k === 0 ? md(p) : folded(esc(p.split('\n')[0].replace(/^## /, '')), md(p.split('\n').slice(1).join('\n')), false))).join('');
    return folded(
      `<span class="status status-${esc((w.meta.status || 'proposed').replace(' ', '-'))}">${esc(w.meta.status || 'proposed')}</span> ${esc(w.meta.title || w.name)}<br><span class="when">${esc(w.meta.area || '')}, proposed by ${esc(w.meta.proposedBy || '?')}${replies ? `, ${replies} repl${replies > 1 ? 'ies' : 'y'}` : ''}</span>`,
      body, false,
    );
  }).join('') || '<p>Nothing in the Workshop yet.</p>'}`;
  }

  const N = document.getElementById('news-for-dave');
  if (N) {
    N.innerHTML = news.length ? `<h2>For Dave</h2>${news.slice(0, 5).map((n, k) => folded(
      `<span class="who">${esc(n.meta.by || '')}</span> <span class="when">${esc(n.meta.date || '')}</span><br><span class="title">${esc(n.meta.title || '')}</span>`,
      md(n.body), k === 0,
    )).join('')}` : '';
  }
}
