const StormDB = require("stormdb");
const { encrypt, decrypt } = require('./crypto.js');
const createConnection = require('./sftp.js');

const Engine = new StormDB.localFileEngine("/tmp/db.stormdb", {
  serialize: data => {
    // encrypt and serialize data
    const encrypted = JSON.stringify(encrypt(JSON.stringify(data)));
    return encrypted;
  },
  deserialize: data => {
    // decrypt and deserialize data
		const decrypted = JSON.parse(decrypt(JSON.parse(data)));
    return decrypted;
  }
});

module.exports = { Engine }
