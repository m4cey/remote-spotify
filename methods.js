const axios = require('axios').default;
const { spotifyClientId, spotifyClientSecret, redirectUri } = require('./config.json');
const SpotifyWebApi = require('spotify-web-api-node');
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const StormDB = require("stormdb");
const { Engine } = require('./database.js');

const dayjs = require('dayjs');
const duration = require('dayjs/plugin/duration');
dayjs().format();
dayjs.extend(duration);

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
            if (!data)
                throw "Can't connect to Spotify API"
            return (data.body.is_playing);
        } catch (error) {
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
            if (!data.body || !data.body.item)
                throw "Can't connect to Spotify API";
            const res = {
                artists: data.body.item.artists.map(obj => obj.name).toString(),
                title: data.body.item.name,
                cover: data.body.item.album.images[0].url || '',
                id: data.body.item.id,
                duration: data.body.item.duration_ms,
                progress: data.body.progress_ms,
                //context: { type: data.body.context.type, uri: data.body.context.uri },
                is_playing: data.body.is_playing,
                is_active: data.body.device.is_active
            };
            console.log(res);
            return (res);
        } catch (error) {
            console.log('in getPlayingTrack(): ', error);
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
            if (!track)
                throw "Can't connect to Spotify API (1)"
            const data = await spotifyApi.containsMySavedTracks([track.id]);
            if (!data)
                throw "Can't connect to Spotify API (2)"
            track.is_saved = data.body[0];
            return (track);
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

async function getUserData(interaction) {
    const spotifyApi = new SpotifyWebApi();
    const db = new StormDB(Engine);
    const userIds = db.get('listening').value();

    if (!userIds)	return;
    let users = [];
    let leaderData;
    for (userId of userIds) {
        try {
            let suffix = '';
            const data = await trackIsSaved(userId);
            if (!data)
                throw "Can't connect to Spotify API"
            if (userId == userIds[0])
                leaderData = data;
            suffix = data.is_saved ? '[❤️]' : '';
            suffix += data.is_playing ? '' : '[◼]';
            suffix += data.is_active ? '' : '[inactive]';
            const name = await getUsername(interaction, userId);
            users.push({
                name: name + suffix,
                duration: data.duration,
                progress: data.progress,
                is_playing: data.is_playing
            });
        } catch (error) {
            console.log('in getUserData(): ', error);
            users.push({ name: '>a dumbass[offline]' });
        }
    }
    return { data: leaderData, users: users };
}

function formatNameList(data) {
    if (!data) return;
    let users = '';
    for (user of data) {
        if (user.duration) {
            const progress = dayjs.duration(user.progress).format('m:ss');
            const duration = dayjs.duration(user.duration).format('m:ss');
            users  += `${user.name}[${progress}/${duration}]\n`;
        } else
            users += `${user.name}\n`;
    }
    return users;
}

async function remoteMessage (userData) {
    if (!userData) return;
    const users = formatNameList(userData.users);
    console.log('LISTENING: ', users);
    let data = userData.data;
    if (!data) {
        const list = ['HELP!', 'PLEASE', 'GETMEOUTOFHERE', 'JUSTKEEPURCOOKIES',
            'SHEHURTSME', 'IWANTOUT', 'CALLCPS', 'HELPME', 'AAAAAAAAAAAAAAAAAAAAAAAAA'];
        data = {
            title: 'nothing',
            artists: 'nobody',
            cover: `https://via.placeholder.com/600/000000/FFFFFF/?text=${
                list[Math.random() * list.length | 0]}!`
        };
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

async function updateRemote (interaction, data) {
    const db = new StormDB(Engine);
    const options = db.get('options').value();
    console.log(options);

    interaction.client.lastMessage ??= interaction.message;

    console.log('creating message...');
    data ??= await getUserData(interaction);
    const progressrate = db.get('options.progressrate').value() || 1000;
    if (data.data && !interaction.client.progressId && data.data.is_playing &&
        db.get('options.updaterate').value() > progressrate) {
        console.log('setting progress interval');
        interaction.client.progressId =
            setInterval(updateProgress, progressrate, interaction, data);
    } else if (!arguments[1] && data.data.is_playing) {
        console.log('updating progress interval');
        clearInterval(interaction.client.progressId);
        interaction.client.progressId =
            setInterval(updateProgress, progressrate, interaction, data);
    }
    //timeout to update on estimated track change
    const delay = data.data.duration - data.data.progress + 3000;
    if (!interaction.client.timeoutId || interaction.client.timeoutDelay > delay) {
        console.log(`setting song duration timeout of ${dayjs.duration(delay).format('m:ss')}`);
        interaction.client.timeoutDelay = delay;
        if (interaction.client.timeoutId)
            clearTimeout(interaction.client.timeoutId);
        interaction.client.timeoutId =
            setTimeout(onTrackChange, delay, interaction);
    }
    const message = await remoteMessage(data);
    console.log('message has been created!');
    let followup = false;
    if (options.followup) {
        followup = true;
        const collection = interaction.channel.messages.cache;
        let threshold = options.threshold;
        for (let i = -1; Math.abs(i) <= threshold; i-- ) {
            const message = collection.get(collection.keyAt(i));
            if (message.applicationId == interaction.message.applicationId) {
                followup = false;
                break;
            }
        }
    }
    if (followup) {
        console.log("following up reply...");
        const blank = { embeds: [{
            description: '***Remote was here***'
        }], components: [] };
        interaction.editReply(blank);
        interaction.client.lastMessage.edit(blank);
        interaction.client.lastMessage = await interaction.followUp(message);
    } else {
        console.log("edititing reply...");
        await interaction.client.lastMessage.edit(message);
    }
    console.log('message updated!');
}

async function updateProgress(interaction, data) {
    if (!getLeaderId() || !(data.users.filter(user => user.is_playing).length)) {
        console.log('clearing progress interval');
        clearInterval(interaction.client.progressId);
        interaction.client.progressId = 0;
        return;
    }
    const db = new StormDB(Engine);
    const progressrate = db.get('options.progressrate').value() || 1000;
    data.users.forEach( user => user.progress += progressrate);
    await updateRemote(interaction, data);
}

async function onTrackChange (interaction) {
    console.log("track change update");
    interaction.client.timeoutId = 0;
    interaction.client.timeoutDelay = 0;
    await updateRemote(interaction);
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
    //updateRemote(interaction);
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
    getUserData,
    trackIsSaved,
    getUsername,
    getPlayingTrack
};
