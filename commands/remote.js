const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const StormDB = require("stormdb");
const { Engine } = require('../database.js');
const state = require('../state');

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
	const partyRow = new MessageActionRow()
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
	const playbackRow = new MessageActionRow()
		.addComponents(
			new MessageButton()
				.setCustomId('previous')
				.setLabel("⏮️")
				.setStyle('SECONDARY'),
			new MessageButton()
				.setCustomId('play')
				.setLabel(state.isPlaying() ? "⏸️" : "▶️")
				.setStyle(state.isPlaying() ? 'SUCCESS' : 'SECONDARY'),
			new MessageButton()
				.setCustomId('next')
				.setLabel("⏭️")
				.setStyle('SECONDARY'),
			new MessageButton()
				.setCustomId('like')
				.setLabel("❤️")
				.setStyle('SECONDARY'),
		);
	return { embeds: [embed], components: [playbackRow, partyRow] }
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
