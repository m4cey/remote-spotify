const axios = require('axios').default;
const { spotifyClientId, spotifyClientSecret, redirectUri } = require('./config.json');
const SpotifyWebApi = require('spotify-web-api-node');
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const StormDB = require("stormdb");
const { Engine } = require('./database.js');

function apiError() {
    console.log('Something went wrong!');
}

function postGuide (interaction) {
    const url = "http://216.27.10.96:27056/guide"
    const embed = new MessageEmbed()
        .setTitle('Authentication required')
        .setDescription("visit the link for an easy guide")
        .setURL(url);
    interaction.followUp({embeds: [embed], ephemeral: true});
}

async function getToken (userId) {
    const db = new StormDB(Engine);
    const cookie = db.get('authenticated').get(userId).value();
    const options = {
        baseURL: 'https://open.spotify.com',
        url: '/get_access_token?reason=transport&productType=web_player',
        method: 'GET',
        headers: {
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0',
        }
    };
    try {
        const res = await axios(options);
        console.log("token request status: ", res.statusText, res.status);
        return (res.data.accessToken);
    } catch (error) {
        console.log(error);
    }
}

async function execute (userId, callback) {
    const spotifyApi = new SpotifyWebApi();
    const db = new StormDB(Engine);

    try {
        const token = await getToken(userId);
        await spotifyApi.setAccessToken(token);
        await callback(spotifyApi, token, userId);
    } catch (error) {
        console.log("in execute(): ", error);
    }
}

async function batchExecute (callback) {
    const spotifyApi = new SpotifyWebApi();
    const db = new StormDB(Engine);

    const userIds = db.get('listening').value();
    for (userId of userIds) {
        try {
            const token = await getToken(userId);
            await spotifyApi.setAccessToken(token);
            await callback(spotifyApi, token, userId);
        } catch (error) {
            console.log(error);
        }
    }
}

function getLeaderId() {
    const db = new StormDB(Engine);
    return leaderId = db.get('listening').value()[0];
}

async function isPlaying () {
    const spotifyApi = new SpotifyWebApi();

    const leaderId = getLeaderId();
    if (leaderId) {
        try {
            const token = await getToken(leaderId);
            spotifyApi.setAccessToken(token);
            const data = await spotifyApi.getMyCurrentPlaybackState();
            return (data.body.is_playing);
        } catch {
            console.log(error);
            return (false);
        }
    }
    return (false);
}

async function getPlayingTrack (userId) {
    const spotifyApi = new SpotifyWebApi();

    userId = userId || getLeaderId();
    if (userId) {
        try {
            const token = await getToken(userId);
            spotifyApi.setAccessToken(token);
            const data = await spotifyApi.getMyCurrentPlaybackState();
            const res = {
                artists: data.body.item.artists.map(obj => obj.name).toString(),
                title: data.body.item.name,
                cover: data.body.item.album.images[0].url || '',
                id: data.body.item.id,
                context: { type: data.body.context.type, uri: data.body.context.uri },
                is_playing: data.body.is_playing,
                is_active: data.body.device.is_active
            };
            console.log(res);
            return (res);
        } catch (error) {
            console.log(error);
        }
    }
}

async function trackIsSaved(userId) {
    const spotifyApi = new SpotifyWebApi();

    if (userId) {
        try {
            const token = await getToken(userId);
            spotifyApi.setAccessToken(token);
            const track = await getPlayingTrack();
            const data = await spotifyApi.containsMySavedTracks([track.id]);
            return ({ id: track.id, is_saved: data.body[0], is_active: track.is_active });
        } catch (error) {
            console.log("In trackIsSaved():", error);
        }
    }
}

async function getUsername(interaction, userId) {
    if (userId) {
        const member = await interaction.guild.members.fetch(userId);
        return (member.nickname || member.user.username);
    }
}

async function getUserList(interaction) {
    const spotifyApi = new SpotifyWebApi();
    const db = new StormDB(Engine);
    const userIds = db.get('listening').value();

    if (!userIds)	return;
    let users = '';
    for (userId of userIds) {
        try {
            let suffix = '';
            const { is_saved, is_active } = await trackIsSaved(userId);
            console.log('is saved:', is_saved);
            suffix = is_saved ? '[❤️]' : '';
            suffix += is_active ? '' : '[inactive]';
            const name = await getUsername(interaction, userId);
            users += `>${name} ${suffix}\n`;
        } catch (error) {
            console.log('User fetch', error);
            users += '>a dumbass[offline]\n';
        }
    }
    return users;
}

async function remoteMessage (interaction) {
    const users = await getUserList(interaction);
    console.log(users);
    let data = await getPlayingTrack();
    if (!data) {
        const list = ['HELP!', 'PLEASE', 'GETMEOUTOFHERE', 'IDONTWANTCOOKIES',
            'SHEHURTSME', 'IWANTOUT', 'CALLCPS', 'HELPME', 'AAAAAAAAAA'];
        data = { title: 'nothing', artists: 'nobody',
            cover: `https://via.placeholder.com/150/000000/FFFFFF/?text=${list[Math.random() * list.length | 0]}!` };
        data.is_playing = await isPlaying();
    }
    const embed = new MessageEmbed()
        .setTitle(`Now Playing:`)
        .setDescription(`\`\`\`${data.title} by ${data.artists}\`\`\``)
        .setThumbnail(data.cover)
        .addField("**Listening:**", `\`\`\`${users || "no users listening"}\`\`\``)
    const partyRow = new MessageActionRow()
        .addComponents(
        new MessageButton()
            .setCustomId('join')
            .setLabel('🙋')
            .setStyle('PRIMARY'),
        new MessageButton()
            .setCustomId('leave')
            .setLabel('🙅')
            .setStyle('DANGER')
            .setDisabled(!users),
        new MessageButton()
            .setCustomId('refresh')
            .setLabel('🧍')
            .setStyle('SECONDARY')
        );
    const playbackRow = new MessageActionRow()
        .addComponents(
        new MessageButton()
            .setCustomId('previous')
            .setLabel("⏮️")
            .setStyle('SECONDARY'),
        new MessageButton()
            .setCustomId('play')
            .setLabel(data.is_playing ? "⏸️" : "▶️")
            .setStyle(data.is_playing ? 'SUCCESS' : 'SECONDARY'),
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

async function updateRemote (interaction) {
    const db = new StormDB(Engine);
    const options = db.get('options').value();
    console.log(options);

    console.log('creating message...');
    const message = await remoteMessage(interaction);
    console.log('message has been created!');
    let followup = false;
    if (options.followup) {
        followup = true;
        const collection = interaction.channel.messages.cache;
        let messageLimit = options.messageLimit;
        for (let i = -1; Math.abs(i) <= messageLimit; i-- ) {
            const message = collection.get(collection.keyAt(i));
            if (message.applicationId == interaction.message.applicationId) {
                followup = false;
                break;
            }
        }
    }
    if (followup) {
        console.log("following up reply...");
        await interaction.followUp(message);
    } else {
        console.log("edititing reply...");
        await interaction.editReply(message);
    }
    console.log('message updated!');
}

function isListener (userId) {
    const db = new StormDB(Engine);
	  const userIds = db.get('listening').value();
    return userIds.includes(userId);
}

function addListener (interaction) {
    const db = new StormDB(Engine);
    console.log('Adding listener ' + interaction.user.tag);
    db.get('listening').push(interaction.user.id).save();
    console.log(db.get('listening').value());
}

function removeListener (interaction) {
    const db = new StormDB(Engine);
    console.log('Removing listener ' + interaction.user.tag);
    const userIds = db.get('listening').value();
    if (!userIds) return;
    const newListeners = userIds.filter(user => user != interaction.user.id);
    db.get('listening').set(newListeners).save();
    console.log(db.get('listening').value());
    updateRemote(interaction);
}

module.exports = {
    updateRemote,
    isListener,
    addListener,
    removeListener,
    postGuide,
    batchExecute,
    execute,
    getToken,
    apiError,
    isPlaying,
    remoteMessage,
    getUserList,
    trackIsSaved,
    getUsername,
    getPlayingTrack
};
