const express = require('express'),
  path = require('path');

  
const config = require('./config');
const { connect } = require('./db/mongo');
const { ensure } = require('./db/fileStore');
const routes = require('./routes');
(async () => {
  await connect();
  await ensure();
  const app = express();
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(routes);
  app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
  app.listen(config.port, config.host, () =>
    console.log(`Management OS: http://${config.host}:${config.port}`)
  );
})().catch(e => {
  console.error(e);
  process.exit(1);
});
