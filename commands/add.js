const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const StormDB = require("stormdb");
const { Engine } = require('../database.js');
const methods = require('../methods.js');

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
			const uri = "spotify:track:" + url.slice(-42, -20);
			await methods.batchExecute(async (spotifyApi, token, userId) => {
				try {
					methods.validateResponse(await spotifyApi.addToQueue(uri));
					await interaction.reply({ embeds: [{description: 'track has been queued'}] });
				} catch (error) {
					console.log(error);
					await failed(interaction);
				}
			});
		} catch (error) {
			console.log(error);
			await failed(interaction);
		}
	}
};
