const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const StormDB = require("stormdb");
const { Engine } = require('../database.js');
const methods = require('../methods.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('login')
		.setDescription('register your credentials with a cookie string')
		.addStringOption(option =>
				option.setName('cookie')
					.setDescription('the [sp_dc] cookie generated on your browser when visiting open.spotify.com')
					.setRequired(true)),
	async execute(interaction) {
		try {
			console.log(`interaction ${interaction.id} beggining deferral`);
			await interaction.deferReply();
			console.log(`interaction ${interaction.id} has been deferred`);
			const db = new StormDB(Engine);
			const cookie = `sp_dc=${interaction.options.getString('cookie')};`;
			console.log(cookie);
			let success = false;
			if (cookie) {
				const oldCookie = db.get('authenticated').get(interaction.user.id).value();
				db.get('authenticated').get(interaction.user.id).set(cookie).save();
				try {
					const token = await methods.getToken(interaction.user.id);
					console.log("TOKEN: ", token);
					if (token && token.length >= 312)
						success = true
				} catch (error) {
					console.log(error);
					if (oldCookie)
						db.get('authenticated').get(interaction.user.id).set(oldCookie);
					else
						db.get('authenticated').get(interaction.user.id).delete();
					db.save();
					success = false;
				}
				if (!success) {
					if (oldCookie)
						db.get('authenticated').get(interaction.user.id).set(oldCookie);
					else
						db.get('authenticated').get(interaction.user.id).delete();
					db.save();
				}
			}
			const embed = new MessageEmbed()
				.setTitle(success ? 'Logged in' : 'Login failed')
				.setDescription(success ? 'fine ig, you can join a party' :
				'it\'s a rotten cookie, I will fucking kill you');

			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.log(error);
			const embed = new MessageEmbed()
				.setTitle('Remote failed')
				.setDescription('not feeling like it rn');
			await interaction.reply({ embeds: [embed] });
		}
	}
};
