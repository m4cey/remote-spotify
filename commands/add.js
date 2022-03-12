const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const StormDB = require("stormdb");
const { Engine } = require('../database.js');
const methods = require('../methods.js');
const SpotifyWebApi = require('spotify-web-api-node');

async function failed (interaction) {
		const embed = new MessageEmbed()
			.setTitle('Remote failed')
			.setDescription('not feeling like it rn');
		await interaction.reply({ embeds: [embed] });
}
module.exports = {
	data: new SlashCommandBuilder()
		.setName('add')
		.setDescription('add track to queue')
		.addStringOption(option =>
				option.setName('track')
					.setDescription('spotify track url')
					.setRequired(true)),
	async execute(interaction) {
		try {
			const url = interaction.options.getString('track');
			if (!url.includes('track')) {
				await interaction.reply({ embeds: [{ description: 'not a track' }] });
				return;
			}
			//0000000000X000000000X000000000X1hGRe4d3LJCg1VszAU8Cy1?si=335842403662483d
			const uri = "spotify:track:" + url.slice(31).split('?')[0];
			console.log(uri);
			const spotifyApi = new SpotifyWebApi();
			const token = await methods.getToken(interaction.user.id);
			spotifyApi.setAccessToken(token);
			methods.validateResponse(await spotifyApi.addToQueue(uri));
			await interaction.reply({ embeds: [{description: 'track has been queued'}] });
		} catch (error) {
			console.log("in execute():", error);
			await failed(interaction);
		}
	}
};
