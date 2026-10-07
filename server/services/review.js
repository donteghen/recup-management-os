const q = require('../queries/management');
async function build(period, anchor) {
  const [activity, recovery, demand, trust, economics, operations, users, funnel] =
    await Promise.all([
      q.activity(period, anchor),
      q.recovery(period, anchor),
      q.demand(period, anchor),
      q.trust(period, anchor),
      q.economics(period, anchor),
      q.operations(period, anchor),
      q.users(period, anchor),
      q.funnel(period, anchor),
    ]);
  return {
    generatedAt: new Date().toISOString(),
    period,
    activity,
    recovery,
    demand,
    trust,
    economics,
    operations,
    users,
    funnel,
  };
}
module.exports = { build };
