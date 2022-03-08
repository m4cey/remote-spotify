const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const StormDB = require("stormdb");
const { Engine } = require('../database.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('options')
		.setDescription('set options?')
		.addSubcommand(subcommand =>
			subcommand.setName('updaterate')
			.setDescription('the content update rate')
			.addNumberOption(option =>
				option
				.setName('rate')
				.setDescription('rate in seconds, eg: 1, 2.5, etc')
				.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand.setName('followup')
			.setDescription('Send a new remote control when there\'s other messages after it')
			.addBooleanOption(option =>
				option
				.setName('enabled')
				.setDescription('enable or disable follow up messages')
				.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand.setName('threshold')
			.setDescription('The amount of messages before sending a follow up')
			.addIntegerOption(option =>
				option
				.setName('threshold')
				.setDescription('a whole number bigger than 0')
				.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand.setName('progressrate')
			.setDescription('the progress update rate')
			.addNumberOption(option =>
				option
				.setName('rate')
				.setDescription('rate in seconds, eg: 1, 2.5, etc')
				.setRequired(true))),

	async execute(interaction) {
		const db = new StormDB(Engine);
		const option = interaction.options.getSubcommand();
		let embed = {};
		let value;
		switch (option) {
			case 'updaterate':
			case 'progressrate':
				value = 1000 * interaction.options.getNumber('rate');
				break;
			case 'followup':
				value = interaction.options.getBoolean('enabled');
				break;
			case 'threshold':
				value = interaction.options.getInteger('threshold');
				break;
			default:
				embed = { title: 'Nothing was set', description: 'didn\'t want to anyways' }
		}
		if (value != null) {
			db.get('options').get(option).set(value).save();
			embed = { description: `${option} = ${value}` }
		}
		console.log(db.get('options').value());
		await interaction.reply({ embeds: [embed] });
	}
};
