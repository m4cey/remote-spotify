require('dotenv').config();
const pino = require('pino');
const logger = pino({
    level: process.env.LOG_LEVEL
}, pino.destination(process.env.LOG || 1));
module.exports = logger;
