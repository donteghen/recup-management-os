const express = require('express'),
  crypto = require('crypto');
const config = require('./config');
const { login, guard } = require('./utils/auth');
const { load, write } = require('./db/fileStore');
const { build } = require('./services/review');
const q = require('./queries/management');
const r = express.Router();
r.use(express.json({ limit: '2mb' }));
r.use(guard);
r.post('/api/login', (req, res) => {
  const token = login(req.body?.password);
  if (!token) return res.status(401).json({ error: 'Invalid password' });
  res.json({ token });
});
r.get('/api/health', (_req, res) => res.json({ ok: true, timezone: config.timezone }));
r.get('/api/state', async (_req, res) => res.json(await load()));
r.get('/api/review/:period', async (req, res) => {
  if (!['week', 'month'].includes(req.params.period))
    return res.status(400).json({ error: 'Invalid period' });
  res.json(await build(req.params.period, req.query.anchor));
});
r.get('/api/metrics/:name/:period', async (req, res) => {
  const fn = q[req.params.name];
  if (!fn || !['day', 'week', 'month'].includes(req.params.period))
    return res.status(400).json({ error: 'Invalid metric request' });
  res.json(await fn(req.params.period));
});
r.get('/api/current-state', async (_req, res) => res.json(await q.currentState()));
r.get('/api/metric-daily', async (req, res) =>
  res.json(await q.metricDaily(Math.min(Number(req.query.days) || 30, 365)))
);
const allowed = new Set([
  'objectives',
  'hypotheses',
  'decisionRules',
  'gates',
  'reviews',
  'decisions',
  'actions',
  'lessons',
]);
r.post('/api/write/:collection', async (req, res) => {
  if (!allowed.has(req.params.collection))
    return res.status(400).json({ error: 'Invalid collection' });
  const data = {
    ...req.body,
    id: req.body.id || crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
  };
  res.status(201).json(await write(req.params.collection, req.body.id ? 'update' : 'create', data));
});
r.post('/api/current-state', async (req, res) =>
  res
    .status(201)
    .json(await write('currentState', 'set', { ...req.body, updatedAt: new Date().toISOString() }))
);
r.delete('/api/delete/:collection/:id', async (req, res) => {
  if (!allowed.has(req.params.collection))
    return res.status(400).json({ error: 'Invalid collection' });
  res.status(201).json(await write(req.params.collection, 'delete', { id: req.params.id }));
});
module.exports = r;
