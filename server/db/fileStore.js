const fs = require('fs/promises'),
  path = require('path'),
  crypto = require('crypto'),
  config = require('../config');
const root = path.join(config.tempDb, 'operations');
let cache = null;
async function ensure() {
  await fs.mkdir(root, { recursive: true });
}
async function files() {
  await ensure();
  const days = await fs.readdir(root, { withFileTypes: true });
  const out = [];
  for (const d of days) {
    if (!d.isDirectory()) continue;
    for (const f of await fs.readdir(path.join(root, d.name)))
      if (f.endsWith('.json')) out.push(path.join(root, d.name, f));
  }
  return out.sort();
}
function blank() {
  return {
    objectives: [],
    hypotheses: [],
    decisionRules: [],
    gates: [],
    reviews: [],
    decisions: [],
    actions: [],
    lessons: [],
    currentState: null,
  };
}
function apply(s, o) {
  if (o.collection === 'currentState') {
    if (o.type === 'set') s.currentState = o.data;
    return;
  }
  const a = s[o.collection];
  if (!Array.isArray(a)) return;
  const i = a.findIndex(x => x.id === o.data?.id);
  if (o.type === 'create' && i < 0) a.push(o.data);
  else if (o.type === 'update') {
    if (i < 0) a.push(o.data);
    else a[i] = { ...a[i], ...o.data };
  } else if (o.type === 'delete' && i >= 0) a.splice(i, 1);
}
async function load() {
  if (cache) return structuredClone(cache);
  const s = blank();
  for (const f of await files()) apply(s, JSON.parse(await fs.readFile(f, 'utf8')));
  cache = s;
  return structuredClone(s);
}
async function write(collection, type, data) {
  const now = new Date(),
    id = crypto.randomUUID(),
    day = now.toISOString().slice(0, 10),
    dir = path.join(root, day);
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, `${now.toISOString().replace(/[:.]/g, '-')}-${id}.json`),
    tmp = target + '.tmp';
  const op = { operationId: id, timestamp: now.toISOString(), collection, type, data };
  await fs.writeFile(tmp, JSON.stringify(op, null, 2), { flag: 'wx' });
  await fs.rename(tmp, target);
  cache = null;
  return op;
}
module.exports = { ensure, load, write };
