const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const SpotifyWebApi = require('spotify-web-api-node');
const StormDB = require("stormdb");
const { encrypt, decrypt } = require('../crypto.js');

const engine = new StormDB.localFileEngine("./db.stormdb", {
  serialize: data => {
    // encrypt and serialize data
    return JSON.stringify(encrypt(JSON.stringify(data)));
  },
  deserialize: data => {
    // decrypt and deserialize data
		const parsed = JSON.parse(data);
    return JSON.parse(decrypt(parsed));
  }
});
const db = new StormDB(engine);

db.default({'listening': {'949235499942416404': 'smth'}}).save();

function getUserList(interaction) {
	if (!db.get('listening').value())
		return;
	const usersID = Object.keys(db.get('listening').value());
	let users = '';
	if (usersID) {
		usersID.forEach(user => users += '<@' + user + '>\n')
	}
	return users;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('remote')
		.setDescription('Start a party and control playback.'),

	async execute(interaction) {
		const users = getUserList(interaction);
		const embed = new MessageEmbed()
			.setTitle('Now listening')
			.setDescription(`${users || 'no users listening'}`)
		//const usersID = Object.keys(db.get('listening').value());
		const row = new MessageActionRow()
			.addComponents(
				new MessageButton()
					.setCustomId('join')
					.setLabel('Join')
					.setStyle('PRIMARY'),
			);
		await interaction.reply({embeds: [embed], components: [row] });
	}
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
