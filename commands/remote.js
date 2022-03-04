const { SlashCommandBuilder } = require('@discordjs/builders');
const SpotifyWebApi = require('spotify-web-api-node');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('remote')
		.setDescription('Start a party and control playback.'),
	async execute(interaction) {
		var scopes = ['user-read-private', 'user-read-email'],
			redirectUri = 'https://localhost:8888/callback',
			clientId = 'dbca940c4d8b43108d852e3ca29b7afb',
			state = 'some-state-of-my-choice';

		// Setting credentials can be done in the wrapper's constructor, or using the API object's setters.
		var spotifyApi = new SpotifyWebApi({
			redirectUri: redirectUri,
			clientId: clientId
		});

		// Create the authorization URL
		var authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);

		// https://accounts.spotify.com:443/authorize?client_id=5fe01282e44241328a84e7c5cc169165&response_type=code&redirect_uri=https://example.com/callback&scope=user-read-private%20user-read-email&state=some-state-of-my-choice
		console.log(authorizeURL);
		await interaction.reply(authorizeURL);
	},
};
