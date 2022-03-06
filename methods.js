const https = require('https');
const { spotifyClientId, spotifyClientSecret, redirectUri } = require('./config.json');
const SpotifyWebApi = require('spotify-web-api-node');
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const StormDB = require("stormdb");
const { Engine } = require('./database.js');
const { remoteMessage } = require('./commands/remote.js');

function updateRemote (interaction) {
    interaction.update(remoteMessage(interaction));
}

function isListener (userId) {
    const db = new StormDB(Engine);
	  const listening = db.get('listening').value();
    return listening.includes(userId);
}

function addListener (interaction) {
    const db = new StormDB(Engine);
    console.log('Adding listener ' + interaction.user.tag);
    db.get('listening').push(interaction.user.id).save();
    console.log(db.get('listening').value());
    updateRemote(interaction);
}

function removeListener (interaction) {
    const db = new StormDB(Engine);
    console.log('Removing listener ' + interaction.user.tag);
    const listening = db.get('listening').value();
    if (!listening) return;
    const newListeners = listening.filter(user => user != interaction.user.id);
    db.get('listening').set(newListeners).save();
    console.log(db.get('listening').value());
    updateRemote(interaction);
}

function postGuide (interaction) {
    const url = "http://localhost:8080/guide"
    const embed = new MessageEmbed()
        .setTitle('Authentication required')
        .setDescription("visit the link for an easy guide")
        .setURL(url);
    interaction.reply({embeds: [embed], ephemeral: true});
}

function getToken (userId) {
    const db = new StormDB(Engine);
    const cookie = db.get('authenticated').get(userId).value();
    const options = {
        hostname: 'open.spotify.com',
        path: '/get_access_token?reason=transport&productType=web_player',
        method: 'GET',
        headers: {
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0',
        }
    };
    const req = https.request(options, res => {
        console.log(`statusCode: ${res.statusCode}`);
        console.log(`headers: ${JSON.stringify(res.headers)}`);
        let data = '';
        res.on('data', (chunk) => {
            data = data + chunk.toString();
        });

        res.on('end', () => {
            const body = JSON.parse(data);
            return (body.accessToken);
        });
    });
    req.on('error', error => {
      console.error(error);
    });

    req.end();
}

function batchExecute(callback) {
    const spotifyApi = new SpotifyWebApi();
    const db = new StormDB(Engine);

    const listening = db.get('listening').value();
    listening.forEach(userId => {
        const token = getToken(userId);
        console.log(`<@${userId}>: `, token);
        spotifyApi.setAccessToken(token);
        callback(spotifyApi, token, userId);
    });
}

module.exports = { updateRemote, isListener, addListener, removeListener, postGuide, batchExecute };
