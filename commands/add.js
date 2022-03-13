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
			subcommand.setName('url')
			.setDescription('Add a song through it\'s URL')
			.addStringOption(option =>
				option
				.setName('url')
				.setDescription('eg: https://open.spotify.com/track/4RdpSi00jdvfRLZb3Q1WhB')
				.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand.setName('search')
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
		const command = interaction.options.getSubcommand();
		if (methods.getIsSearching()) {
			interaction.reply({
				embeds: [{description: 'patience??'}],
				ephemeral: true
			});
			return;
		}
		if (!methods.getOnPlaylist()) {
			interaction.reply({
				embeds: [{description: 'and where do you want me to add this to...'}],
				ephemeral: true
			});
			return;
		}
		methods.getIsSearching(true);
		const spotifyApi = new SpotifyWebApi();
		try {
			if (command == 'url') {
				const url = interaction.options.getString('url');
				if (!url.includes('open.spotify.com/track/')) {
					await interaction.reply({
						embeds: [{ description: 'maybe learn to copy your links better' }],
						ephemeral: true,
					});
					methods.getIsSearching(false);
					return;
				}
				const id = url.slice(31).split('?')[0];
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
				const title = interaction.options.getString('title');
				const artist = interaction.options.getString('artist');
				if (!artist && !title) {
					await interaction.reply({
						embeds: [{
							description: 'ahaha, dumbass'
						}],
						ephemeral: true,
					});
					methods.getIsSearching(false);
					return;
				}
				try {
					await interaction.deferReply();
					methods.getSearchIndex(0);
					const query = (title ? `track:${title}` : '') + (title && artist ? '+' : '') +
						(artist ? `artist:${artist}` : '');
					console.log('QUERY:', query);
					const data = await methods.getSearchData(interaction, query);
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
