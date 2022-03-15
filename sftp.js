const logger = require('./logger.js');
require('dotenv').config();
let Client = require('ssh2-sftp-client');

async function createConnection () {
  let sftp = new Client();
  try {
    await sftp.connect({
      host: process.env.SFTP_HOST,
      port: process.env.SFTP_PORT,
      username: process.env.SFTP_USER,
      password: process.env.SFTP_PASSWORD,
    });
    return sftp;
  } catch (error) {
    logger.error(error);
  }
}

module.exports = createConnection;
