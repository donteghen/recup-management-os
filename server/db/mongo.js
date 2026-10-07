const { MongoClient } = require('mongodb');
const config = require('../config');
let client, db;
async function connect() {
  if (db) return db;
  client = new MongoClient(config.mongoUri, { readPreference: 'secondaryPreferred' });
  await client.connect();
  db = client.db(config.mongoDb);
  return db;
}
function getDb() {
  if (!db) throw new Error('MongoDB not connected');
  return db;
}
async function close() {
  if (client) await client.close();
  client = null;
  db = null;
}
module.exports = { connect, getDb, close };
