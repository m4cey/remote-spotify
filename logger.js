require('dotenv').config();
const pino = require('pino');
const logger = pino({
    level: process.env.LOG_LEVEL
});
module.exports = logger;
