const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const StormDB = require("stormdb");
const { Engine } = require('../database.js');
const methods = require('../methods.js');
const SpotifyWebApi = require('spotify-web-api-node');

function failed (interaction) {
	const embed = new MessageEmbed()
		.setTitle('Remote failed')
		.setDescription('not feeling like it rn');
	return ({ embeds: [embed] });
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('add')
		.setDescription('Add a song to the current playlist')
		.addSubcommand(subcommand =>
			subcommand.setName('URL')
			.setDescription('Add a song through it\'s URL')
			.addStringOption(option =>
				option
				.setName('URL')
				.setDescription('eg: https://open.spotify.com/track/4RdpSi00jdvfRLZb3Q1WhB')
				.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand.setName('Search')
			.setDescription('Search for a track providing a title and/or artist name')
			.addStringOption(option =>
				option
				.setName('title')
				.setDescription('Song\'s title'))
			.addStringOption(option =>
				option
				.setName('artist')
				.setDescription('Song\'s artist'))),

	async execute(interaction) {
		if (methods.getIsSearching()) {
			interaction.reply({
				embeds: [{description: 'A song is already being added'}],
				ephemeral: true
			});
			return;
		}
		if (!methods.getOnPlaylist()) {
			interaction.reply({
				embeds: [{description: 'Create a playlist first'}],
				ephemeral: true
			});
			return;
		}
		methods.getIsSearching(true);
		const spotifyApi = new SpotifyWebApi();
		try {
			const search = interaction.options.getString('search');
			if (search.includes('open.spotify.com')) {
				if (!search.includes('track')) {
					await interaction.reply({ embeds: [{ description: 'invalid URL' }] });
					return;
				}
				const id = search.slice(31).split('?')[0];
				try {
					await interaction.deferReply();
					const token = await methods.getToken(interaction.user.id);
					await spotifyApi.setAccessToken(token);
					let track = await spotifyApi.getTrack(id);
					methods.validateResponse(track, true);
					methods.getSearchIndex(0);
					track = track.body;
					track.artists = track.artists.map(obj => obj.name).join();
					track.cover = track.album?.images?.[0]?.url;
					const data = { tracks: [track], offset: 0, total: 1 };
					const message = methods.searchMessage(interaction, data, true);
					await interaction.editReply(message);
					methods.getIsSearching(false);
					// actually add the song here
					methods.addToPlaylist(track.uri);
				} catch (error) {
					console.log("in execute().url", error);
				}
			} else {
				try {
					await interaction.deferReply();
					methods.getSearchIndex(0);
					const data = await methods.getSearchData(interaction, search);
					const message = methods.searchMessage(interaction, data, false);
					await interaction.editReply(message);
					// song will be added through button events
				} catch (error) {
					console.log("in execute().search", error);
				}
			}
		} catch (error) {
				console.log("in execute():", error);
				await interaction.editReply(failed());
		} finally {
			spotifyApi.resetAccessToken();
		}
	}
};
