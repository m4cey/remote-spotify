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

function generateAuthLink (interaction) {
    const authorizeURL = "https://open.spotify.com/get_access_token?reason=transport&productType=web_player";
    const embed = new MessageEmbed()
        .setTitle('Access Token required')
        .setDescription("copy the contents of `accessToken` and use it with `/login`")
        .setURL(authorizeURL);
    interaction.reply({embeds: [embed], ephemeral: true});
}

function batchExecute(callback) {
    const spotifyApi = new SpotifyWebApi();
    const db = new StormDB(Engine);

    const listening = db.get('listening').value();
    listening.forEach(userId => {
        const token = db.get('authenticated').get(userId).value();
        console.log(`<@${userId}>: `, token);
        spotifyApi.setAccessToken(token);
        callback(spotifyApi, token, userId);
    });
}

module.exports = { updateRemote, isListener, addListener, removeListener, generateAuthLink, batchExecute };
