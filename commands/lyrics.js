require('dotenv').config();
const logger = require('../logger.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { getLyrics } = require('genius-lyrics-api');
const methods = require('../methods.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('lyrics')
		.setDescription('Fetch the current song lyrics from Genius'),
	async execute(interaction) {
		if (!methods.isAuthenticated(interaction.user.id)) {
			const message = methods.inactiveMessage();
			interaction.reply(message);
			return;
		}
		try {
			await interaction.deferReply();
			const data = await methods.getPlaybackData(interaction.user.id);
			const options = {
				apiKey: process.env.GENIUS_KEY,
				title: data.title,
				artist: data.artists.split(',')[0],
				optimizeQuery: true,
				authHeader: true,
			}
			let embed = {};
			embed.title = data.title + ' by ' + data.artists;
			embed.description = '```' +
				( await getLyrics(options) || "It's empty, like my soul...") + '```';
			embed.author = { icon_url: data.cover };
			embed.footer = { text: 'Stolen from Genius.com.' };
			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			logger.error(error);
			if (error.status == 204) {
				const message = methods.inactiveMessage();
				interaction.editReply(message);
				return;
			}
			await interaction.editReply(methods.failedMessage());
		}
	}
};
