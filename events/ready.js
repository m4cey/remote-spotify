require("dotenv").config();
const logger = require("../logger.js");
const fs = require("node:fs");
const StormDB = require("stormdb");
const { Engine } = require("../database.js");
const createConnection = require("../sftp.js");

async function retrieveDB() {
  sftp = await createConnection();
  logger.debug("Retrieving stormdb file");
  try {
    await sftp.fastGet("/storage/db.stormdb", "/tmp/db.stormdb");
  } catch (error) {
    logger.error(error, "Couldn't retrieve db");
  }
}

async function updateDB() {
  fs.watch("/tmp/db.stormdb", async () => {
    logger.debug("db changed, uploading...");
    await sftp.fastPut("/tmp/db.stormdb", "/storage/db.stormdb");
    logger.debug("finished uploading...");
  });
}

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    if (process.env.LOCAL != 1) {
      await retrieveDB();
      updateDB();
    }
    logger.info(`Ready! Logged in as ${client.user.tag}`);
    console.log(`Ready! Logged in as ${client.user.tag}`);
    const db = new StormDB(Engine);
    db.default({
      authenticated: {},
      options: {
        followup: true,
        threshold: 6,
        retries: 4,
        delay: 3000,
        updaterate: 5000,
        margin: 10000,
        sync_cooldown: 5000,
      },
    }).save();
  },
};
