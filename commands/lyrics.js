require('dotenv').config();
const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { getLyrics } = require('genius-lyrics-api');
const methods = require('../methods.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('lyrics')
		.setDescription('Fetch the current song lyrics from Genius'),
	async execute(interaction) {
		try {
			await interaction.deferReply();
			const data = await methods.getPlaybackData(interaction.user.id);
			const options = {
				apiKey: process.env.genius_key,
				title: data.title,
				artist: data.artists.split(',')[0],
				optimizeQuery: true,
				authHeader: true,
			}
			let embed = {};
			embed.title = data.title + ' by ' + data.artists;
			embed.description = '```' + await getLyrics(options) + '```';
			embed.author = { icon_url: data.cover };
			embed.footer = { text: 'Stolen from Genius.com.' };
			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.log(error);
			const embed = new MessageEmbed()
				.setTitle('Remote failed')
				.setDescription('not feeling like it rn');
			await interaction.editReply({ embeds: [embed] });
		}
	}
};
