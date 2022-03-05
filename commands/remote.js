const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const StormDB = require("stormdb");
const { Engine } = require('../database.js');

function getUserList(interaction) {
	const db = new StormDB(Engine);
	const userIds = db.get('listening').value();
	if (!userIds)	return;
	let users = '';
	userIds.forEach(user => users += '<@' + user + '>\n')
	return users;
}

function buildMessage(interaction) {
	const users = getUserList(interaction);
	const embed = new MessageEmbed()
		.setTitle('Now listening')
		.setDescription(`${users || "```no users listening```"}`)
	const row = new MessageActionRow()
		.addComponents(
			new MessageButton()
				.setCustomId('join')
				.setLabel('Join')
				.setStyle('PRIMARY'),
			new MessageButton()
				.setCustomId('leave')
				.setLabel('Leave')
				.setStyle('DANGER')
				.setDisabled(!users)
		);
	return { embeds: [embed], components: [row] }
}
module.exports = {
	data: new SlashCommandBuilder()
		.setName('remote')
		.setDescription('Start a party and control playback.'),

	async execute(interaction) {
		const users = getUserList(interaction);
		const message = buildMessage(interaction);

		await interaction.reply(message);
	},
	buildMessage
};
