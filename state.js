const methods = require('./methods.js');
const StormDB = require("stormdb");
const { Engine } = require('./database.js');

let playing = false;

function setPlaying (value) { playing = value }

function isPlaying () { return playing }

function previousTrack () {
    console.log('Playing the previous track!');
}

function nextTrack () {
    console.log('Playing the next track!');
}

function likeTrack (interaction) {
    console.log( interaction.user.tag +' Liked the track!');
}

module.exports = { isPlaying, setPlaying, previousTrack, nextTrack, likeTrack };
