const app = require('../src/app');

// Explicitly forward requests to the Express app
module.exports = (req, res) => app(req, res);


