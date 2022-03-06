const { spotifyClientId, spotifyClientSecret, redirectUri } = require('./config.json');
const SpotifyWebApi = require('spotify-web-api-node');
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const StormDB = require("stormdb");
const { Engine } = require('./database.js');
const db = new StormDB(Engine);

const remoteMenu = require('./commands/remote.js');

function updateRemote (interaction) {
    interaction.update(remoteMenu.buildMessage(interaction));
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
    const listeners = db.get('listening').value();
    if (!listeners) return;
    const newListeners = listeners.filter(user => user != interaction.user.id);
    db.get('listening').set(newListeners).save();
    console.log(db.get('listening').value());
    updateRemote(interaction);
}

function generateAuthLink (interaction) {
    const authorizeURL = "https://open.spotify.com/get_access_token?reason=transport&productType=web_player";
    const embed = new MessageEmbed()
        .setTitle('Access Token required')
        .setDescription("copy the ```accessToken``` content and use it to login with `/login`")
        .setURL(authorizeURL);
    interaction.reply({embeds: [embed], ephemeral: true});
}

module.exports = { updateRemote, isListener, addListener, removeListener, generateAuthLink, setTokens };
