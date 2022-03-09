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
		.setName('playlist')
		.setDescription('set playlist as queue')
		.addStringOption(option =>
				option.setName('playlist')
					.setDescription('spotify playlist url')
					.setRequired(true)),
	async execute(interaction) {
		try {
			const url = interaction.options.getString('playlist');
			if (!url.includes('playlist')) {
				await interaction.reply({ embeds: [{ description: 'not a playlist' }] });
				return;
			}
			const context = "spotify:playlist:" + url.slice(-42, -20);
			await methods.batchExecute(async (spotifyApi, token, userId) => {
				try {
					await spotifyApi.play({ context_uri: context });
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
