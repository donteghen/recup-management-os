const app = document.getElementById('app');
let token = localStorage.getItem('mos_token');
let state = null;
let activeReviewType = null;

async function api(url, opt = {}) {
  const h = {
    ...(opt.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const r = await fetch(url, { ...opt, headers: h });
  if (r.status === 401) {
    logout();
    throw Error('Unauthorized');
  }
  const d = await r.json();
  if (!r.ok) throw Error(d.error || 'Request failed');
  return d;
}

const esc = s =>
  String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const fmt = n => (n == null ? '—' : new Intl.NumberFormat().format(n));
const pct = n => (n == null ? '—' : `${(n * 100).toFixed(1)}%`);
const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

function logout() {
  localStorage.removeItem('mos_token');
  token = null;
  renderLogin();
}

function renderLogin() {
  app.innerHTML = `
        <main class="min-h-screen grid place-items-center p-6">
            <form id="login" class="card w-full max-w-sm p-7">
                <div class="mb-7">
                    <p class="text-xs font-semibold uppercase tracking-[.18em] text-slate-500">Recup</p>
                    <h1 class="text-2xl font-bold mt-2">Management OS</h1>
                    <p class="text-sm text-slate-500 mt-2">Private local management workbench</p>
                </div>
                <label class="text-sm font-medium">
                    Password
                    <input id="password" type="password" class="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5">
                </label>
                <button class="mt-5 w-full rounded-xl bg-slate-900 text-white py-2.5">Enter</button>
                <p id="err" class="text-sm text-red-600 mt-3"></p>
            </form>
        </main>`;

  document.getElementById('login').onsubmit = async e => {
    e.preventDefault();
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: document.getElementById('password').value }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      token = d.token;
      localStorage.setItem('mos_token', token);
      renderShell();
    } catch (x) {
      document.getElementById('err').textContent = x.message;
    }
  };
}

function renderShell() {
  app.innerHTML = `
        <div class="min-h-screen flex">
            <aside class="w-64 bg-white border-r border-slate-200 p-4 hidden md:block">
                <div class="px-3 py-4">
                    <div class="font-bold text-lg">Management OS</div>
                    <div class="text-xs text-slate-500 mt-1">Africa/Douala · read-only operations</div>
                </div>
                <nav class="space-y-1 mt-4">
                    ${[
                      ['home', 'Current State'],
                      ['weekly', 'Weekly Review'],
                      ['monthly', 'Monthly Review'],
                      ['quarterly', 'Quarterly Review'],
                      ['strategy', 'Strategy'],
                      ['history', 'History'],
                    ]
                      .map(
                        ([a, b]) => `
                        <button data-view="${a}" class="nav w-full text-left px-3 py-2.5 rounded-xl">${b}</button>
                    `
                      )
                      .join('')}
                </nav>
                <button id="lock" class="mt-8 px-3 text-sm text-slate-500">Lock</button>
            </aside>
            <main class="flex-1 p-5 md:p-8">
                <div class="md:hidden flex justify-between mb-6">
                    <b>Management OS</b>
                    <button id="lock2">Lock</button>
                </div>
                <div id="content"></div>
            </main>
        </div>`;

  document.querySelectorAll('.nav').forEach(x => (x.onclick = () => show(x.dataset.view)));
  document.getElementById('lock').onclick = document.getElementById('lock2').onclick = logout;
  show('home');
}

function card(t, v, s = '') {
  return `
        <div class="card p-5">
            <div class="text-sm text-slate-500">${t}</div>
            <div class="metric text-3xl font-bold mt-2">${v}</div>
            ${s ? `<div class="text-xs text-slate-500 mt-2">${s}</div>` : ''}
        </div>`;
}

function shellTitle(k, t, d) {
  return `
        <div class="mb-7">
            <p class="text-xs uppercase tracking-[.18em] text-slate-500">${k}</p>
            <h1 class="text-3xl font-bold mt-2">${t}</h1>
            <p class="text-slate-500 mt-2 max-w-3xl">${d}</p>
        </div>`;
}

async function show(v) {
  document
    .querySelectorAll('.nav')
    .forEach(x => x.classList.toggle('nav-active', x.dataset.view === v));
  if (v === 'home') return home();
  if (v === 'weekly') return review('week');
  if (v === 'monthly') return review('month');
  if (v === 'quarterly') return quarterly();
  if (v === 'strategy') return strategy();
  if (v === 'history') return history();
}

async function home() {
  const c = document.getElementById('content');
  state = await api('/api/state');
  const live = await api('/api/current-state').catch(() => null);

  c.innerHTML =
    shellTitle(
      'Management OS',
      'Current State',
      'The management layer answers what matters now. Operational truth stays in MongoDB; decisions and reviews live here.'
    ) +
    `
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            ${card('Active items', fmt(live?.activeItems))}
            ${card('Open claims', fmt(live?.openClaims))}
            ${card('Unpassable items', fmt(live?.unpassableItems))}
            ${card('Open complaints', fmt(live?.openComplaints))}
        </div>
        <div class="grid lg:grid-cols-2 gap-5 mt-6">
            <div class="card p-5">
                <h2 class="font-semibold">Current phase</h2>
                <input id="phase" class="mt-3 w-full border border-slate-300 rounded-xl p-3" value="${esc(state.currentState?.phase || 'PROVE')}">
                <h2 class="font-semibold mt-5">Primary objective</h2>
                <input id="objective" class="mt-3 w-full border border-slate-300 rounded-xl p-3" value="${esc(state.currentState?.objective || 'PROVE RECOVERY')}">
            </div>
            <div class="card p-5">
                <h2 class="font-semibold">Constraints</h2>
                <textarea id="constraints" class="mt-3 w-full min-h-36 border border-slate-300 rounded-xl p-3">${esc(state.currentState?.constraints || '')}</textarea>
                <button id="saveState" class="mt-3 rounded-xl bg-slate-900 text-white px-4 py-2">Save state</button>
            </div>
        </div>
        <div class="card p-5 mt-6">
            <div class="flex justify-between">
                <h2 class="font-semibold">MetricDaily operating trend</h2>
                <span class="text-xs text-slate-500">Database source · global scope</span>
            </div>
            <canvas id="trend" class="mt-5 max-h-80"></canvas>
        </div>`;

  document.getElementById('saveState').onclick = async () => {
    await api('/api/current-state', {
      method: 'POST',
      body: JSON.stringify({
        phase: document.getElementById('phase').value,
        objective: document.getElementById('objective').value,
        constraints: document.getElementById('constraints').value,
      }),
    });
    show('home');
  };

  const md = await api('/api/metric-daily?days=30');
  new Chart(document.getElementById('trend'), {
    type: 'line',
    data: {
      labels: md
        .slice()
        .reverse()
        .map(x => x.date),
      datasets: [
        {
          label: 'Items posted',
          data: md
            .slice()
            .reverse()
            .map(x => x.metrics?.itemsPosted || 0),
        },
        {
          label: 'Claims attempted',
          data: md
            .slice()
            .reverse()
            .map(x => x.metrics?.claimsAttempted || 0),
        },
        {
          label: 'Recoveries',
          data: md
            .slice()
            .reverse()
            .map(x => x.metrics?.claimsCompleted || 0),
        },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });
}

function list(rows, label = 'name') {
  return `
        <div class="card divide-y divide-slate-100">
            ${
              (rows || [])
                .slice(0, 8)
                .map(
                  x => `
                <div class="p-4 flex justify-between gap-4">
                    <span>${esc(x[label] || x._id || 'Unknown')}</span>
                    <b>${fmt(x.count)}</b>
                </div>
            `
                )
                .join('') || '<div class="p-4 text-slate-500">No data</div>'
            }
        </div>`;
}

async function review(period) {
  activeReviewType = period;
  const c = document.getElementById('content');
  const today = new Date().toISOString().slice(0, 10);

  c.innerHTML =
    shellTitle(
      'Review',
      period === 'week' ? 'Weekly Review' : 'Monthly Review',
      'DATA → CONTEXT → INTERPRETATION → DECISION → ACTION → RESULT → LEARNING'
    ) +
    `
        <div class="card p-5 mb-6 flex flex-wrap items-end gap-4">
            <label class="text-sm">
                Anchor date
                <input id="anchor" type="date" value="${today}" class="block mt-2 border border-slate-300 rounded-xl px-3 py-2">
            </label>
            <button id="load" class="rounded-xl bg-slate-900 text-white px-4 py-2.5">Load review</button>
        </div>
        <div id="reviewBody">Loading…</div>`;

  document.getElementById('load').onclick = () => loadReview(period);
  loadReview(period);
}

async function loadReview(period) {
  const anchor = document.getElementById('anchor').value;
  const r = await api(`/api/review/${period}?anchor=${anchor}`);
  const b = r.recovery,
    t = r.trust,
    d = r.demand,
    e = r.economics;

  document.getElementById('reviewBody').innerHTML = `
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            ${card('Items posted', fmt(r.activity.itemsPosted))}
            ${card('Claims attempted', fmt(b.attempted))}
            ${card('Recoveries completed', fmt(b.completed))}
            ${card('Complaints', fmt(t.complaints))}
        </div>
        <div class="grid lg:grid-cols-3 gap-4 mt-5">
            ${card('Pass rate', pct(b.passRate))}
            ${card('Recovery rate', pct(b.completionRate))}
            ${card('Donations received', `${fmt(e.received.amount)} XAF`, `${fmt(e.received.count)} records`)}
        </div>
        <div class="grid lg:grid-cols-2 gap-5 mt-6">
            <div>${section('Demand by category', list(d.categories))}</div>
            <div>${section('Demand by city', list(d.cities))}</div>
            <div>${section('Trust & safety', list(t.categories, '_id'))}</div>
            <div>${section('Recovery statuses', list(b.byStatus, '_id'))}</div>
        </div>
        ${reviewForm(period, anchor, r)}`;
}

function section(t, b) {
  return `<h2 class="font-semibold mb-3">${t}</h2>${b}`;
}

function reviewForm(period, anchor, r) {
  return `
        <div class="card p-6 mt-6">
            <h2 class="text-lg font-semibold">Management interpretation</h2>
            <p class="text-sm text-slate-500 mt-1">The numbers are facts. These fields are your management layer.</p>
            ${field('Facts', 'facts', 'What happened? Keep this factual; the database already provides the measurements.', JSON.stringify({ period, anchor, activity: r.activity, recovery: r.recovery, trust: r.trust }, null, 2))}
            ${field('Interpretation', 'interpretation', 'What does it mean? What changed? What surprised us?')}
            ${field('Attention', 'attention', 'What deserves attention now?')}
            ${field('Decision', 'decision', 'What are we deciding, and why?')}
            ${field('Actions', 'actions', 'Concrete actions, owner, deadline, expected result.')}
            ${field('Learning', 'learning', 'What should change in our beliefs, rules, or operating system?')}
            <button id="saveReview" class="mt-5 rounded-xl bg-slate-900 text-white px-5 py-2.5">Save review</button>
        </div>`;
}

function field(t, id, p, placeholder = '') {
  return `
        <label class="block mt-5">
            <span class="font-medium">${t}</span>
            <span class="block text-xs text-slate-500 mt-1">${p}</span>
            <textarea id="${id}" class="mt-2 w-full min-h-24 rounded-xl border border-slate-300 p-3">${esc(placeholder)}</textarea>
        </label>`;
}

async function saveReview() {
  const r = {
    reviewType: activeReviewType,
    periodAnchor: document.getElementById('anchor').value,
    facts: document.getElementById('facts').value,
    interpretation: document.getElementById('interpretation').value,
    attention: document.getElementById('attention').value,
    decision: document.getElementById('decision').value,
    actions: document.getElementById('actions').value,
    learning: document.getElementById('learning').value,
  };
  await api('/api/write/reviews', { method: 'POST', body: JSON.stringify(r) });
  alert('Review saved.');
  show(activeReviewType === 'month' ? 'monthly' : 'weekly');
}

document.addEventListener('click', e => {
  if (e.target.id === 'saveReview') saveReview();
});

async function quarterly() {
  const c = document.getElementById('content');
  c.innerHTML =
    shellTitle(
      'Review',
      'Quarterly Review',
      'Quarterly review is deliberately strategic: compare what we believed with what happened, identify what was wrong, and change the operating system.'
    ) +
    `
        <div class="card p-6">
            ${field('What we believed', 'beliefs', 'What did we believe at the start of the quarter?')}
            ${field('What happened', 'happened', 'What actually happened?')}
            ${field('What was wrong', 'wrong', 'Which assumptions, plans, or forecasts were wrong?')}
            ${field('What worked', 'worked', 'Which choices or systems worked?')}
            ${field('What changes', 'changes', 'What changes for the next quarter?')}
            ${field('New priorities', 'priorities', 'What becomes important now?')}
            <button id="saveQuarter" class="mt-5 rounded-xl bg-slate-900 text-white px-5 py-2.5">Save quarterly review</button>
        </div>`;

  document.getElementById('saveQuarter').onclick = async () => {
    await api('/api/write/reviews', {
      method: 'POST',
      body: JSON.stringify({
        period: 'quarter',
        beliefs: val('beliefs'),
        happened: val('happened'),
        wrong: val('wrong'),
        worked: val('worked'),
        changes: val('changes'),
        priorities: val('priorities'),
      }),
    });
    alert('Quarterly review saved.');
    show('history');
  };
}

const val = id => document.getElementById(id).value;

async function strategy() {
  state = await api('/api/state');
  const c = document.getElementById('content');
  c.innerHTML =
    shellTitle(
      'Strategy',
      'Strategy & decision rules',
      'The plan may change. The process for changing the plan does not.'
    ) +
    `
        <div class="grid lg:grid-cols-2 gap-5">
            ${editor('Objectives', 'objectives')}
            ${editor('Hypotheses', 'hypotheses')}
            ${editor('Decision rules', 'decisionRules')}
            ${editor('Expansion & delegation gates', 'gates')}
        </div>`;
}

function editor(title, key) {
  const rows = state[key] || [];
  return `
        <div class="card p-5">
            <h2 class="font-semibold">${title}</h2>
            <div class="mt-3 space-y-2">
                ${
                  rows
                    .map(
                      x => `
                    <div class="rounded-xl bg-slate-50 p-3 text-sm">
                        ${esc(x.title || x.name || x.description || JSON.stringify(x))}
                    </div>
                `
                    )
                    .join('') || '<div class="text-sm text-slate-500">Nothing recorded.</div>'
                }
            </div>
            <textarea id="new-${key}" class="mt-4 w-full border border-slate-300 rounded-xl p-3" placeholder="Add ${title.toLowerCase()}…"></textarea>
            <button onclick="add('${key}')" class="mt-2 rounded-xl bg-slate-900 text-white px-4 py-2">Add</button>
        </div>`;
}

window.add = async key => {
  const el = document.getElementById(`new-${key}`);
  if (!el.value.trim()) return;
  await api(`/api/write/${key}`, {
    method: 'POST',
    body: JSON.stringify({ title: el.value.trim(), createdAt: new Date().toISOString() }),
  });
  strategy();
};

async function history() {
  state = await api('/api/state');
  const c = document.getElementById('content');
  c.innerHTML =
    shellTitle(
      'History',
      'Management History',
      'Reviews, decisions, actions and lessons are local Management OS records, separate from operational data.'
    ) +
    `
        <div class="grid lg:grid-cols-2 gap-5">
            ${historyCard('Reviews', state.reviews)}
            ${historyCard('Decisions', state.decisions)}
            ${historyCard('Actions', state.actions)}
            ${historyCard('Lessons', state.lessons)}
        </div>`;
}

function historyCard(title, rows) {
  return `
        <div class="card p-5">
            <h2 class="font-semibold">${title}</h2>
            <div class="mt-3 space-y-3 max-h-96 overflow-auto">
                ${
                  rows
                    .slice()
                    .reverse()
                    .map(
                      x => `
                    <div class="border-b border-slate-100 pb-3">
                        <div class="text-sm font-medium">
                            ${esc(x.title || x.decision || x.action || x.learning || x.interpretation || 'Record')}
                        </div>
                        <div class="text-xs text-slate-500 mt-1">
                            ${esc(x.updatedAt || x.createdAt || '')}
                        </div>
                    </div>
                `
                    )
                    .join('') || '<div class="text-sm text-slate-500">No records yet.</div>'
                }
            </div>
        </div>`;
}

if (token) renderShell();
else renderLogin();
