const serverless = require('serverless-http');
const app = require('../src/app');

// create the handler once to avoid re-instantiation per request
const handler = serverless(app);

module.exports = handler;


