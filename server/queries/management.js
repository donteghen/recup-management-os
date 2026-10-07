const { getDb } = require('../db/mongo');
const { bounds } = require('../utils/dates');
const c = n => getDb().collection(n);
const range = (field, b) => ({ [field]: { $gte: b.start, $lt: b.end } });
function periodBounds(period, anchor) {
  return bounds(period, anchor ? new Date(`${anchor}T12:00:00+01:00`) : new Date());
}

async function currentState() {
  const [active, openClaims, unpassableRows, users, items, complaints] = await Promise.all([
    c('items').countDocuments({ status: 'active' }),
    c('claims').countDocuments({ status: { $in: ['pending', 'verified', 'accepted'] } }),
    c('items')
      .aggregate([
        { $match: { status: 'active', claimAttempts: { $gt: 0 } } },
        { $lookup: { from: 'claims', localField: 'itemId', foreignField: 'itemId', as: 'claims' } },
        {
          $match: {
            $expr: {
              $eq: [
                {
                  $size: {
                    $filter: { input: '$claims', as: 'c', cond: { $eq: ['$$c.passed', true] } },
                  },
                },
                0,
              ],
            },
          },
        },
        { $count: 'count' },
      ])
      .toArray(),
    c('users').countDocuments({ deletedAt: { $exists: false } }),
    c('items').countDocuments({}),
    c('complaints').countDocuments({ status: { $in: ['pending', 'escalated'] } }),
  ]);
  return {
    activeItems: active,
    openClaims: openClaims,
    unpassableItems: unpassableRows[0]?.count || 0,
    activeUsers: users,
    totalItems: items,
    openComplaints: complaints,
  };
}

async function metricDaily(days = 30) {
  return c('metricdailies')
    .find({ scope: 'global' })
    .sort({ date: -1 })
    .limit(Number(days) || 30)
    .toArray();
}

async function activity(period, anchor) {
  const b = periodBounds(period, anchor);
  const [items, claims, signups, views, viewsByItem, complaints, donations, ratings] =
    await Promise.all([
      c('items').countDocuments(range('createdAt', b)),
      c('claims').countDocuments(range('attemptedAt', b)),
      c('users').countDocuments(range('createdAt', b)),
      c('itemviews').countDocuments(range('viewedAt', b)),
      c('items')
        .aggregate([
          { $match: range('createdAt', b) },
          {
            $group: {
              _id: '$category.categoryId',
              categoryName: { $first: '$category.categoryName' },
              views: { $sum: { $ifNull: ['$views', 0] } },
            },
          },
          { $sort: { views: -1 } },
        ])
        .toArray(),
      c('complaints').countDocuments(range('createdAt', b)),
      c('donations').countDocuments({
        receivedAt: { $gte: b.start, $lt: b.end },
        status: 'received',
      }),
      c('ratings').countDocuments(range('createdAt', b)),
    ]);
  return {
    period,
    bounds: { start: b.start, end: b.end, localStart: b.localStart, localEnd: b.localEnd },
    itemsPosted: items,
    claimsAttempted: claims,
    signups,
    uniqueViewerEvents: views,
    complaintsFiled: complaints,
    donationRecords: donations,
    ratingsSubmitted: ratings,
    viewsByCategory: viewsByItem,
  };
}

async function recovery(period, anchor) {
  const b = periodBounds(period, anchor);
  const [attempted, passed, completed, failed, byStatus, byModel, timeToRecovery] =
    await Promise.all([
      c('claims').countDocuments(range('attemptedAt', b)),
      c('claims').countDocuments({ attemptedAt: { $gte: b.start, $lt: b.end }, passed: true }),
      c('claims').countDocuments({ completedAt: { $gte: b.start, $lt: b.end } }),
      c('claims').countDocuments({ attemptedAt: { $gte: b.start, $lt: b.end }, passed: false }),
      c('claims')
        .aggregate([
          { $match: range('attemptedAt', b) },
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ])
        .toArray(),
      c('claims')
        .aggregate([
          { $match: range('attemptedAt', b) },
          { $lookup: { from: 'items', localField: 'itemId', foreignField: 'itemId', as: 'item' } },
          { $unwind: { path: '$item', preserveNullAndEmptyArrays: true } },
          {
            $group: {
              _id: '$item.recoveryModel',
              count: { $sum: 1 },
              completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            },
          },
        ])
        .toArray(),
      c('claims')
        .aggregate([
          { $match: { completedAt: { $gte: b.start, $lt: b.end }, attemptedAt: { $ne: null } } },
          {
            $project: {
              hours: { $divide: [{ $subtract: ['$completedAt', '$attemptedAt'] }, 3600000] },
            },
          },
          {
            $group: {
              _id: null,
              averageHours: { $avg: '$hours' },
              medianHours: { $percentile: { input: '$hours', p: [0.5], method: 'approximate' } },
            },
          },
        ])
        .toArray(),
    ]);
  return {
    period,
    attempted,
    passed,
    failed,
    completed,
    passRate: attempted ? passed / attempted : null,
    completionRate: attempted ? completed / attempted : null,
    byStatus,
    byRecoveryModel: byModel,
    timeToRecovery: timeToRecovery[0] || null,
  };
}

async function demand(period, anchor) {
  const b = periodBounds(period, anchor);
  const [categories, subcategories, cities, quarters, models, statuses, age] = await Promise.all([
    c('items')
      .aggregate([
        { $match: range('createdAt', b) },
        {
          $group: {
            _id: '$category.categoryId',
            name: { $first: '$category.categoryName' },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ])
      .toArray(),
    c('items')
      .aggregate([
        { $match: range('createdAt', b) },
        {
          $group: {
            _id: '$category.subcategoryId',
            name: { $first: '$category.subcategoryName' },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ])
      .toArray(),
    c('items')
      .aggregate([
        { $match: range('createdAt', b) },
        {
          $group: {
            _id: '$location.city',
            name: { $first: '$location.cityName' },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ])
      .toArray(),
    c('items')
      .aggregate([
        { $match: range('createdAt', b) },
        { $group: { _id: '$location.quarter', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray(),
    c('items')
      .aggregate([
        { $match: range('createdAt', b) },
        { $group: { _id: '$recoveryModel', count: { $sum: 1 } } },
      ])
      .toArray(),
    c('items')
      .aggregate([
        { $match: range('createdAt', b) },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray(),
    c('items')
      .aggregate([
        { $match: range('createdAt', b) },
        {
          $group: {
            _id: null,
            averageAgeDays: {
              $avg: { $divide: [{ $subtract: [new Date(), '$dateFound'] }, 86400000] },
            },
          },
        },
      ])
      .toArray(),
  ]);
  return {
    period,
    categories,
    subcategories,
    cities,
    quarters,
    recoveryModels: models,
    statuses,
    averageAgeDays: age[0]?.averageAgeDays ?? null,
  };
}

async function trust(period, anchor) {
  const b = periodBounds(period, anchor);
  const [
    complaints,
    categories,
    roles,
    escalations,
    resolved,
    ratings,
    fraud,
    suspensions,
    nearMisses,
  ] = await Promise.all([
    c('complaints').countDocuments(range('createdAt', b)),
    c('complaints')
      .aggregate([
        { $match: range('createdAt', b) },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray(),
    c('complaints')
      .aggregate([
        { $match: range('createdAt', b) },
        { $group: { _id: '$complainantRole', count: { $sum: 1 } } },
      ])
      .toArray(),
    c('complaints').countDocuments({ escalatedAt: { $gte: b.start, $lt: b.end } }),
    c('complaints').countDocuments({ resolvedAt: { $gte: b.start, $lt: b.end } }),
    c('ratings')
      .aggregate([
        { $match: range('createdAt', b) },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            average: { $avg: '$stars' },
            oneStar: { $sum: { $cond: [{ $eq: ['$stars', 1] }, 1, 0] } },
          },
        },
      ])
      .toArray(),
    c('claims').countDocuments({
      attemptedAt: { $gte: b.start, $lt: b.end },
      rejectionCategory: 'not_owner',
    }),
    c('users').countDocuments({ suspendedAt: { $gte: b.start, $lt: b.end } }),
    c('claims').countDocuments({
      createdAt: { $gte: b.start, $lt: b.end },
      reviewRequest: { $exists: true },
    }),
  ]);
  return {
    period,
    complaints,
    categories,
    roles,
    escalations,
    resolved,
    ratings: ratings[0] || { count: 0, average: null, oneStar: 0 },
    fraudSignals: fraud,
    suspensions,
    nearMisses,
  };
}

async function economics(period, anchor) {
  const b = periodBounds(period, anchor);
  const [received, allocations, channels, pledges, pledgeFulfilled, totalReceived] =
    await Promise.all([
      c('donations')
        .aggregate([
          { $match: { receivedAt: { $gte: b.start, $lt: b.end }, status: 'received' } },
          { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
        ])
        .toArray(),
      c('donations')
        .aggregate([
          { $match: { receivedAt: { $gte: b.start, $lt: b.end }, status: 'received' } },
          { $group: { _id: '$allocation', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
          { $sort: { amount: -1 } },
        ])
        .toArray(),
      c('donations')
        .aggregate([
          { $match: { receivedAt: { $gte: b.start, $lt: b.end }, status: 'received' } },
          { $group: { _id: '$channel', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
          { $sort: { amount: -1 } },
        ])
        .toArray(),
      c('claims').countDocuments({
        createdAt: { $gte: b.start, $lt: b.end },
        pledgeAmount: { $gt: 0 },
      }),
      c('claims').countDocuments({
        pledgeStatus: 'fulfilled',
        pledgeFulfilledAt: { $gte: b.start, $lt: b.end },
      }),
      c('donations')
        .aggregate([
          { $match: { status: 'received' } },
          { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
        ])
        .toArray(),
    ]);
  return {
    period,
    received: received[0] || { count: 0, amount: 0 },
    allocations,
    channels,
    pledgesOffered: pledges,
    pledgesFulfilled: pledgeFulfilled,
    totalReceived: totalReceived[0] || { count: 0, amount: 0 },
  };
}

async function operations(period, anchor) {
  const b = periodBounds(period, anchor);
  const [activity, audit, activityByAction, auditByAction, targetTypes] = await Promise.all([
    c('activitylogs').countDocuments(range('createdAt', b)),
    c('auditlogs').countDocuments(range('createdAt', b)),
    c('activitylogs')
      .aggregate([
        { $match: range('createdAt', b) },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ])
      .toArray(),
    c('auditlogs')
      .aggregate([
        { $match: range('createdAt', b) },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ])
      .toArray(),
    c('auditlogs')
      .aggregate([
        { $match: range('createdAt', b) },
        { $group: { _id: '$targetType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray(),
  ]);
  return {
    period,
    userActivityRows: activity,
    adminAuditRows: audit,
    userActions: activityByAction,
    adminActions: auditByAction,
    auditTargets: targetTypes,
  };
}

async function users(period, anchor) {
  const b = periodBounds(period, anchor);
  const [created, verified, deleted, suspended, distribution, ratings] = await Promise.all([
    c('users').countDocuments(range('createdAt', b)),
    c('users').countDocuments(range('emailVerifiedAt', b)),
    c('users').countDocuments(range('deletedAt', b)),
    c('users').countDocuments(range('suspendedAt', b)),
    c('users')
      .aggregate([
        { $match: { deletedAt: { $exists: false } } },
        {
          $bucket: {
            groupBy: '$reputationScore',
            boundaries: [0, 50, 100, 150, 201],
            default: 'other',
            output: { count: { $sum: 1 } },
          },
        },
      ])
      .toArray(),
    c('users')
      .aggregate([
        { $match: { deletedAt: { $exists: false }, totalRatings: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$averageRating' },
            averageReputation: { $avg: '$reputationScore' },
            usersRated: { $sum: 1 },
          },
        },
      ])
      .toArray(),
  ]);
  return {
    period,
    created,
    verified,
    deleted,
    suspended,
    reputationDistribution: distribution,
    ratingReputation: ratings[0] || null,
  };
}

async function funnel(period, anchor) {
  const b = periodBounds(period, anchor);
  const [posted, attempted, passed, accepted, contact, recovered] = await Promise.all([
    c('items').countDocuments(range('createdAt', b)),
    c('claims').countDocuments(range('attemptedAt', b)),
    c('claims').countDocuments({ attemptedAt: { $gte: b.start, $lt: b.end }, passed: true }),
    c('claims').countDocuments({ attemptedAt: { $gte: b.start, $lt: b.end }, status: 'accepted' }),
    Promise.resolve(null),
    c('claims').countDocuments({ completedAt: { $gte: b.start, $lt: b.end } }),
  ]);
  return {
    period,
    stages: { reported: posted, claimsAttempted: attempted, passed, accepted, recovered },
    rates: {
      claimRate: posted ? attempted / posted : null,
      passRate: attempted ? passed / attempted : null,
      acceptRate: passed ? accepted / passed : null,
      recoveryRate: posted ? recovered / posted : null,
    },
    note: 'Contact revelation is intentionally not inferred from current state fields because the event history schema was not provided.',
  };
}

module.exports = {
  currentState,
  metricDaily,
  activity,
  recovery,
  demand,
  trust,
  economics,
  operations,
  users,
  funnel,
};
