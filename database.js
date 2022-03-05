const StormDB = require("stormdb");
const { encrypt, decrypt } = require('./crypto.js');

const Engine = new StormDB.localFileEngine("./db.stormdb"/*, {
  serialize: data => {
    // encrypt and serialize data
    return JSON.stringify(encrypt(JSON.stringify(data)));
  },
  deserialize: data => {
    // decrypt and deserialize data
		const parsed = JSON.parse(data);
    return JSON.parse(decrypt(parsed));
  }
}*/);

module.exports = { Engine }
