require('dotenv').config();
const logger = require('../logger.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const methods = require('../methods.js');
const SpotifyWebApi = require('spotify-web-api-node');

module.exports = {
	data: new SlashCommandBuilder()
	.setName('mischief')
	.setDescription('we do a little trolling')
	.addUserOption(option =>
		option.setName('victim')
		.setDescription('muahahaha')
		.setRequired(true)),
	async execute(interaction) {
		try {
			await interaction.deferReply();
			const user = interaction.options.getUser('victim');

				if (methods.isListener(user.id)) {
					const message = methods.newMessage("victim already in the party", "wake up", true);
					interaction.editReply(message);
					return;
				}
				if (methods.isAuthenticated(user.id)) {
					const spotifyApi = new SpotifyWebApi();
					try {
						const token = await methods.getToken(user.id);
						if (!token) throw "No token provided"
						spotifyApi.setAccessToken(token);
						const data = await spotifyApi.getMyCurrentPlaybackState();
						methods.validateResponse(data, true);
						await methods.addListener(interaction, user.id);
						await interaction.editReply(methods.newMessage('','victim victimized', true));
					} catch (error) {
						logger.error(error, 'in JoinButton():');
						if (error.status == 204) {
							const message = methods.inactiveMessage();
							interaction.editReply(message);
						}
					} finally {
						spotifyApi.resetAccessToken();
					}
				} else {
					await interaction.editReply(methods.failedMessage());
				}
		} catch (error) {
			logger.error(error);
			await interaction.editReply(methods.failedMessage());
		}
	}
};
