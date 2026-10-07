const crypto = require('crypto'),
  config = require('../config'),
  sessions = new Map();
const hash = x => crypto.createHash('sha256').update(String(x)).digest();
function equal(a, b) {
  const x = hash(a),
    y = hash(b);
  return crypto.timingSafeEqual(x, y);
}
function login(p) {
  if (!equal(p || '', config.password)) return null;
  const t = crypto.randomBytes(32).toString('hex');
  sessions.set(t, Date.now() + config.sessionTtlHours * 3600000);
  return t;
}
function valid(t) {
  const e = sessions.get(t);
  if (!e) return false;
  if (e < Date.now()) {
    sessions.delete(t);
    return false;
  }
  return true;
}
function guard(req, res, next) {
  if (req.path === '/api/login' || req.path === '/api/health') return next();
  if (!valid((req.headers.authorization || '').replace(/^Bearer\s+/i, '')))
    return res.status(401).json({ error: 'Unauthorized' });
  next();
}
module.exports = { login, guard };
