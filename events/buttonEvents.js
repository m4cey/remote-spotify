const { Engine } = require('../database.js');
const db = new StormDB(Engine);

let methods = {};

methods.joinButton = (interaction) => {
	const listening = db.get('listening').value();

}

module.exports = {
	name: 'interactionCreate',
	execute(interaction) {
		if (!interaction.isButton())	return;
		console.log(`${interaction.user.tag} in #${interaction.channel.name} triggered a button: ${interaction.customId}`);

		methods[interaction.customId + 'Button'](interaction);
	},
};

/*
		if (!usersID)
		{
			// Send an authentication link.
			var scopes = ['user-read-private', 'user-read-email'],
				redirectUri = 'http://216.27.10.96:27079/callback',
				clientId = 'c7900867b98d4bf599c3a00bb1c0b00e',
				state = interaction.user.id;

			// Setting credentials can be done in the wrapper's constructor, or using the API object's setters.
			var spotifyApi = new SpotifyWebApi({
				redirectUri: redirectUri,
				clientId: clientId
			});

			// Create the authorization URL
			var authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);
		}
		*/
