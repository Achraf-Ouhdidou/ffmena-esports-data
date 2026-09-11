require('dotenv').config({ quiet: true });
const { loadConfig } = require('./config');
const { createApp } = require('./app');

const config = loadConfig();
const { app, store } = createApp({ config });
const server = app.listen(config.port, config.host, () => {
  console.log(JSON.stringify({
    level: 'info',
    message: 'FFMENA server started',
    host: config.host,
    port: config.port,
    environment: config.environment
  }));
});

function shutdown(signal) {
  console.log(JSON.stringify({ level: 'info', message: 'Shutting down', signal }));
  server.close(() => {
    store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));