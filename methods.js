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
    const scopes = ['ugc-image-upload', 'user-read-playback-state',
        'user-modify-playback-state', 'user-read-private', 'user-follow-modify',
        'user-follow-read', 'user-library-modify', 'user-library-read',
        'user-read-playback-position', 'playlist-modify-private',
        'playlist-read-collaborative', 'playlist-read-private',
        'playlist-modify-public', 'user-read-currently-playing'],
        state = interaction.user.id;

    const spotifyApi = new SpotifyWebApi({
        redirectUri: redirectUri,
        clientId: spotifyClientId
        });
    const authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);
    const embed = new MessageEmbed()
        .setTitle('Authentication required')
        .setDescription('you can try to join again after logging in')
        .setURL(authorizeURL);
    interaction.reply({embeds: [embed], ephemeral: true});
}

function setTokens (data) {
    console.log(data);
    const userId = data.state;
    const code = data.code;
    const credentials = { clientId: spotifyClientId,
        clientSecret: spotifyClientSecret, redirectUri: redirectUri };
    const spotifyApi = new SpotifyWebApi(credentials);

    spotifyApi.authorizationCodeGrant(code).then(
        function (data) {
            console.log('The token expires in ' + data.body['expires_in']);
            console.log('The access token is ' + data.body['access_token']);
            console.log('The refresh token is ' + data.body['refresh_token']);
            const tokens = { 'accessToken': data.body['access_token'],
                'refreshToken': data.body['refresh_token'] };
            db.get('authenticated').get(userId).set(tokens).save();
        },
        function (err) {
            console.log('Code grant failed!', err);
        }
    );
}

module.exports = { updateRemote, addListener, removeListener, generateAuthLink, setTokens };
