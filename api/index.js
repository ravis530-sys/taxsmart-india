// Vercel serverless function entry point.
// The server is compiled to server/dist/ during the build step; this file
// simply re-exports the Express app so Vercel can call it as a handler.
const { default: app } = require('../server/dist/index');
module.exports = app;
