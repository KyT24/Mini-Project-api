import app from '../src/server';

// Mendukung baik ES Module maupun CommonJS handler di Vercel Serverless
export default app;
module.exports = app;
module.exports.default = app;
