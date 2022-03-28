require("dotenv").config();
const wait = require("node:timers/promises").setTimeout;
const logger = require("./logger.js");
const axios = require("axios").default;
const SpotifyWebApi = require("spotify-web-api-node");
const { MessageActionRow, MessageButton, MessageEmbed } = require("discord.js");
const StormDB = require("stormdb");
const { Engine } = require("./database.js");
const { getColorFromURL } = require("color-thief-node");

let listening = [];
let state = [];
let queue = {};
let usernames = {};
let accounts = {};
let syncing = {};
let lastMessage;
let updateOnInterval;
let updateIntervalId;
let timeoutId;
let timeoutDelay;
let searchData;
let searchIndex = 0;
let searchOffset = 0;
let isSearching = false;
let searchSize = 5;
let refreshOnce = false;

class apiError {
  constructor(message, status) {
    this.message = message;
    this.status = status;
  }
}

function validateResponse(data, device_error) {
  if (!data) throw new apiError("Can't connect to spotify API", 503);
  if (data.statusCode == 404) throw new apiError("Resource not found", 404);
  if (device_error && data.statusCode == 204)
    throw new apiError("User device is inactive", 204);
  if (data.body.error)
    throw new apiError(data.body.error.message, data.body.error.status);
}

function newMessage(title, description, ephemeral) {
  const embed = {};
  if (title) embed.title = title;
  if (description) embed.description = description;
  return { embeds: [embed], ephemeral: ephemeral };
}

function failedMessage() {
  return newMessage("Remote failed", "not feeling like it rn", true);
}

function blankMessage() {
  const blank = newMessage(null, "***Remote was here***");
  blank.components = [];
  return blank;
}

function inactiveMessage() {
  const message = {
    embeds: [
      {
        title: "Device is inactive",
        description:
          "Make sure your spotify app is open and play a track to make it active!",
      },
    ],
    ephemeral: true,
  };
  return message;
}

function postGuide(interaction) {
  const message = newMessage(
    "Authentication Required",
    "use `/login` to generate session cookies.",
    true
  );
  interaction.followUp(message);
}

async function getToken(userId) {
  const db = new StormDB(Engine);
  const cookie = db.get("authenticated").get(userId)?.value();
  try {
    if (!cookie) throw "Failed to get cookies";
    const options = {
      baseURL: "https://open.spotify.com",
      url: "/get_access_token?reason=transport&productType=web_player",
      method: "GET",
      headers: {
        Cookie: cookie,
        "User-Agent": "Mozilla/5.0",
      },
    };
    const res = await axios(options);
    return res.data.accessToken;
  } catch (error) {
    logger.error(error);
    if (!cookie) {
      removeListener(userId);
    }
    refreshOnce = false;
  }
}

function getLastMessage() {
  return lastMessage;
}

function setLastMessage(message) {
  lastMessage = message;
}

function getLeaderId() {
  return (leaderId = listening[0]);
}

function getListening() {
  return listening;
}

function getPlayingTrack() {
  return {
    id: state[0].track.id,
    is_playing: state[0].is_playing,
    name: state[0].track.name,
    artists: state[0].artists,
  };
}

function isSaved(userId) {
  if (userId) {
    const user = state.filter((user) => user.userId == userId)[0];
    return user.is_saved;
  }
}

async function getQueue(data, limit) {
  const spotifyApi = new SpotifyWebApi();
  try {
    if (!data) throw "data object is null";
    if (!data.context) throw "context object is null";
    if (!data.context.type) throw "type object is null";
    const token = await getToken(data.userId);
    if (!token) throw "No token provided";
    spotifyApi.setAccessToken(token);
    let index = 0;
    let found = false;
    let done = false;
    let tracks;
    do {
      if (found) {
        logger.debug("MATCH FOUND AT: " + index);
        done = found;
      }
      const options = {
        fields: "items(track(id,uri,name)),total",
        limit: limit,
        offset: index + found,
      };
      if (data.context.type == "playlist")
        tracks = await spotifyApi.getPlaylistTracks(data.playlist.id, options);
      else if (data.context.type == "album")
        tracks = await spotifyApi.getAlbumTracks(data.album.id, options);
      validateResponse(tracks, true);
      if (data.context.type == "album")
        tracks.body.items = tracks.body.items.map((item) => {
          return {
            track: { id: item.id, name: item.name, uri: item.uri },
          };
        });
      if (!found) {
        index = tracks.body.items.findIndex(
          (item) => item.track.id == data.track.id
        );
        if (index < 0 && tracks.body.items.length < limit) {
          throw "couldn't find original track in queue";
        }
        found = index >= 0;
        index =
          index >= 0 ? index + options.offset : options.offset + options.limit;
      }
    } while (!found || !done);
    const queue = { tracks: [], index: index, total: tracks.body.total };
    tracks.body.items.forEach((item) => queue.tracks.push(item.track));
    spotifyApi.resetAccessToken();
    return queue;
  } catch (error) {
    logger.warn(error, "in getQueue():");
    return { index: 0, tracks: [], total: 0 };
  } finally {
    spotifyApi.resetAccessToken();
  }
}

async function getPlaybackData(userId, retries, interaction) {
  const spotifyApi = new SpotifyWebApi();
  try {
    const token = await getToken(userId);
    if (!token) throw "No token provided";
    spotifyApi.setAccessToken(token);
    const data = await spotifyApi.getMyCurrentPlaybackState();
    validateResponse(data, true);
    let res = {
      artists: data.body.item?.artists.map((obj) => obj.name).toString(),
      title: data.body.item?.name,
      cover: data.body.item?.album.images[0].url,
      track: {
        id: data.body.item?.id,
        uri: data.body.item?.uri,
        url: `https://open.spotify.com/track/${data.body.item?.id}`,
      },
      duration: data.body.item?.duration_ms,
      progress: data.body.progress_ms,
      context: {
        type: data.body.context?.type,
        uri: data.body.context?.uri,
      },
      is_playing: data.body.is_playing,
      userId: userId,
      album: {
        name: data.body.item?.album?.name,
        type: data.body.item?.album?.album_type,
        id: data.body.item?.album?.id,
        url: data.body.item?.album?.external_urls.spotify,
      },
      artist: {
        name: data.body.item?.artists?.[0].name,
        url: data.body.item?.artists?.[0].external_urls.spotify,
      },
    };
    if (res.track?.id) {
      const saved = await spotifyApi.containsMySavedTracks([res.track.id]);
      validateResponse(saved, true);
      res.is_saved = saved.body[0];
    }
    if (res.context.uri?.length && res.context.type === "playlist") {
      const id = res.context.uri.split(":").pop();
      logger.info(id);
      const options = {
        fields: "collaborative,name,public,external_urls,owner",
      };
      const data = await spotifyApi.getPlaylist(id, options);
      validateResponse(data, true);
      res.playlist = {
        collaborative: data.body.collaborative,
        public: data.body.public,
        name: data.body.name,
        url: data.body.external_urls.spotify,
        id: id,
        owner: data.body.owner.id,
      };
    }
    return res;
  } catch (error) {
    logger.error(error, "in getPlaybackData(): ");
    if (listening[0] !== userId && error.status == 204) {
      interaction.followUp(inactiveMessage());
      interaction.followUp(`<@${userId}> disconnected!`);
      removeListener(userId);
      return;
    }
    try {
      const db = new StormDB(Engine);
      const delay = db.get("options.delay").value();
      let res;
      if (retries > 0) {
        if (updateIntervalId) clearInterval(updateIntervalId);
        updateOnInterval = false;
        logger.warn("RETRIES LEFT %d", retries);
        syncing[userId] = true;
        await wait(delay || 3000);
        res = await getPlaybackData(userId, retries - 1, interaction);
      }
      if (listening[0] === userId && !res && !retries) {
        logger.error("LEADER TIMED OUT %d", userId);
        removeListener(userId);
        interaction.followUp(`<@${userId}> disconnected!`);
      } else if (res) {
        logger.info("Connection recieved");
        return res;
      }
    } catch (error) {
      removeListener(userId);
      try {
        interaction.followUp(`<@${userId}> disconnected!`);
      } catch (error) {
        logger.error(error);
      }
    } finally {
      updateOnInterval = true;
      setUpdateInterval(interaction);
    }
  } finally {
    spotifyApi.resetAccessToken();
  }
}

async function getUsername(interaction, userId) {
  if (userId) {
    const member = await interaction.guild.members.fetch(userId);
    return member.nickname || member.user.username;
  }
}

function getUser(userId) {
  return state?.find((user) => user.userId === userId);
}

async function getUserData(interaction) {
  if (!listening.length) return;
  let users = [];
  for (let i = 0; i < listening.length; i++) {
    try {
      const db = new StormDB(Engine);
      const retries = db.get("options.retries").value();
      let data = await getPlaybackData(
        listening[i],
        (retries || 4) * !i,
        interaction
      );
      if (!data) throw "data object is null";
      data.name = usernames[listening[i]];
      data.accountId = accounts[listening[i]];
      if (i > 0) {
        data.is_synced = isSynced(users[0], data);
      }
      users.push(data);
    } catch (error) {
      logger.error(error, `in getUserData().loop: ${listening[i]}`);
    }
  }
  return users;
}

function getContextData(data) {
  let context = { name: "" };
  try {
    if (!data) throw "data object is null or empty";
    if (!data.context) throw "data.context is null";
    if (!data.context.type) throw "data.context.type is null";
    if (data.context.type == "artist") throw "artist context not supported";
    const type = data.context.type;
    const index = data.queue
      ? ` (${data.queue.index + 1 || "0"}/${data.queue.total || "0"})`
      : "";
    context = {
      name: `${type.replace(/^\w/, (c) => c.toUpperCase())}: ${
        data[type].name
      }${index}`,
      url: data[type].url,
    };
  } catch (error) {
    logger.warn(error, "In getContextData():");
  }
  return context;
}

function formatNameList(data) {
  if (!data || !data.length || !data[0].userId) return "no users listening";
  let users = "";
  for (let user of data) {
    let suffix = user.is_saved ? "💗" : "";
    suffix += user.is_playing ? "" : "⏸️";
    suffix += getPlaylistOwner() == user.userId ? "📼" : "";
    let prefix = user == data[0] ? "👑" : user.is_synced ? "🌈" : "🤔";
    users += `${prefix} ${user.name} ${suffix}\n`;
  }
  return users;
}

function formatQueue(data) {
  if (!data?.queue) return;
  const amount = Math.min(4, data.queue?.tracks?.length || 0);
  let queue = "";
  for (let i = 0; i < amount; i++) {
    queue += `${data.queue.index + 2 + i} - ${data.queue.tracks[i].name}\n`;
  }
  return queue;
}

function rgbToHex(r, g, b) {
  return [r, g, b]
    .map((x) => {
      const hex = x.toString(16).split(".")[0];
      return hex.length === 1 ? "0" + hex : hex;
    })
    .join("");
}

function randomHex() {
  const rgb = [1, 1, 1].map(() => Math.random() * 255);
  return rgbToHex(...rgb);
}

async function remoteMessage(data) {
  const users = formatNameList(data);
  const userCount = data ? data.length : 0;
  const context = getContextData(data ? data[0] : null);
  // logger.debug("CONTEXT: " + context.name);
  const queue = formatQueue(data ? data[0] : null);
  const list = [
    "HELP!",
    "PLEASE",
    "GETMEOUTOFHERE",
    "IWANTOUT",
    "CALLCPS",
    "HELPME",
    "AAAAAAAAAAAAAAAAAAAAAAAAA",
  ];
  let color = randomHex();
  data ??= [];
  data[0] ??= {};
  data[0].title ??= "nothing";
  data[0].artists ??= "nobody";
  color = data[0].cover
    ? rgbToHex(...(await getColorFromURL(data[0].cover)))
    : color;
  data[0].cover ??= `https://via.placeholder.com/600/${color}/FFFFFF/?text=${
    list[(Math.random() * list.length) | 0]
  }!`;
  data[0].is_playing ??= false;
  let fields = [
    {
      name: `Listening: ${listening.length || ""}`,
      value: `\`\`\`${users}\`\`\``,
    },
  ];
  if (queue) fields.push({ name: "Next up:", value: `\`\`\`${queue}\`\`\`` });
  const embed = new MessageEmbed()
    .setTitle(`Now Playing:`)
    .setDescription(`\`\`\`${data[0].title} by ${data[0].artists}\`\`\``)
    .setThumbnail(data[0].cover)
    .setAuthor(context)
    .setURL(data[0].track?.url || "")
    .addFields(fields)
    .setColor("#" + color);
  const partyRow = new MessageActionRow().addComponents(
    new MessageButton().setCustomId("join").setLabel("🙋").setStyle("PRIMARY"),
    new MessageButton()
      .setCustomId("leave")
      .setLabel("🙅")
      .setStyle("DANGER")
      .setDisabled(!userCount),
    new MessageButton()
      .setCustomId("refresh")
      .setLabel("🧍")
      .setStyle("SECONDARY"),
    new MessageButton()
      .setCustomId("playlist")
      .setLabel("📼")
      .setStyle("SECONDARY")
      .setDisabled(!userCount)
  );
  const playbackRow = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId("previous")
      .setLabel("⏮️")
      .setStyle("SECONDARY"),
    new MessageButton()
      .setCustomId("play")
      .setLabel(data[0].is_playing ? "⏸️" : "▶️")
      .setStyle(data[0].is_playing ? "SUCCESS" : "SECONDARY"),
    new MessageButton()
      .setCustomId("next")
      .setLabel("⏭️")
      .setStyle("SECONDARY"),
    new MessageButton().setCustomId("like").setLabel("❤️").setStyle("SECONDARY")
  );
  return { embeds: [embed], components: [playbackRow, partyRow] };
}

function getRefreshOnce(value) {
  if (arguments.length > 0) refreshOnce = value;
  return refreshOnce;
}

function isSynced(leader, user) {
  const db = new StormDB(Engine);
  const margin = db.get("options.margin").value();

  let unsynced = user.is_playing != leader.is_playing;
  unsynced ||=
    user.track.id == leader.track.id &&
    Math.abs(user.progress - leader.progress) > margin;
  unsynced ||=
    user.track.id != leader.track.id && user.duration - user.progress > margin;
  unsynced ||= user.new;
  return !unsynced;
}

async function syncPlayback(users) {
  try {
    if (!users || users.length <= 1) throw "data object is invalid";
    const leader = users[0];
    const spotifyApi = new SpotifyWebApi();

    for (let user of users) {
      if (!leader.track.id) continue;
      syncing[user.userId] ??= false;
      logger.debug(`${user.name} is syncing = ${syncing[user.userId]}`);
      if (user == leader || syncing[user.userId]) continue;
      const token = await getToken(user.userId);
      if (!token) throw "No token provided";
      spotifyApi.setAccessToken(token);
      const synced = isSynced(leader, user);
      if (synced) continue;
      logger.debug(`${user.userId} ${user.name} >>>>UNSYNCED`);
      syncing[user.userId] = true;
      try {
        if (user.track.id != leader.track.id) {
          const options = { uris: [leader.track.uri] };
          if (leader.queue.tracks.length)
            options.uris.concat(leader.queue.tracks.map((track) => track.uri));
          validateResponse(await spotifyApi.play(options));
        }
      } catch (error) {
        logger.error(error, "in syncPlayback().loop.play()");
      }
      try {
        validateResponse(await spotifyApi.seek(leader.progress));
      } catch (error) {
        logger.error(error, "in syncPlayback().loop.seek()");
      }
      try {
        if (!leader.is_playing && user.is_playing)
          validateResponse(await spotifyApi.pause());
        else if (leader.is_playing && !user.is_playing)
          validateResponse(await spotifyApi.play());
      } catch (error) {
        logger.error(error, "in syncPlayback().loop.pause()");
      } finally {
        logger.debug("syncing done");
        //disable syncing for user for a timeout to avoid conflicts
        setTimeout(
          (user) => {
            syncing[user.userId] = false;
          },
          5000,
          user
        );
        spotifyApi.resetAccessToken();
      }
    }
  } catch (error) {
    logger.error(error, "In syncPlayback():");
  }
}

async function refreshRemote(interaction) {
  const db = new StormDB(Engine);
  const options = db.get("options").value();

  if (refreshOnce) return;
  refreshOnce = true;
  lastMessage ??= interaction.message;
  message = await remoteMessage(state);
  // followup threshold test
  let followup = false;
  if (options.followup) {
    followup = true;
    const collection = interaction.channel.messages.cache;
    let threshold = options.threshold;
    for (let i = -1; Math.abs(i) <= threshold; i--) {
      const message = collection.get(collection.keyAt(i));
      if (message.applicationId == interaction.message.applicationId) {
        followup = false;
        break;
      }
    }
  }
  try {
    if (followup) {
      const blank = blankMessage();
      try {
        const temp = await interaction.followUp(message);
        interaction.editReply(blank);
        lastMessage.edit(blank);
        lastMessage = temp;
      } catch (error) {
        logger.warn(error, "In refreshRemote().followip");
        followup = false;
      }
    }
    if (!followup) {
      if (lastMessage) await lastMessage.edit(message);
      else {
        lastMessage = await interaction.message.edit(message);
      }
    }
  } catch (error) {
    logger.error(error, "In refreshRemote()");
  }
}

function compareState(data) {
  if (
    !data ||
    !state ||
    state.length != data.length ||
    state[0]?.track?.id != data[0]?.track?.id ||
    state[0]?.context?.uri != data[0]?.context?.uri
  )
    return true;
  for (let i = 0; i < data.length; i++) {
    let changed = state[i]?.is_playing != data[i]?.is_playing;
    changed ||= state[i]?.is_saved != data[i]?.is_saved;
    changed ||= state[i]?.is_synced != data[i]?.is_synced;
    if (changed) return true;
  }
  return false;
}

async function updateRemote(interaction) {
  try {
    let data = await getUserData(interaction);
    if (compareState(data)) {
      logger.debug("State has changed!");
      refreshOnce = false;
    }
    if (!data) {
      state = null;
      throw "data object is null";
    }
    // update queue on track change
    if (data[0] && state?.[0]?.track?.id != data[0]?.track?.id) {
      data[0].queue = await getQueue(data[0], 10);
      queue = data[0].queue;
    } else if (data[0]) {
      // restore data that wasn't computed from state
      data[0].queue = queue;
      if (state && state[0]) data[0].color = state[0].color;
    }

    if (data.length > 1) syncPlayback(data);
    // update local state; no manipulating data after this point
    if (data && data.length) state = data;
    //timeout to update on estimated track end
    try {
      if (!data[0] || !data[0].progress) throw "data object is invalid";
      const delay = data[0].duration - data[0].progress + 3000;
      if (!timeoutId || timeoutDelay > delay) {
        timeoutDelay = delay;
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(onTrackChange, delay, interaction);
      }
    } catch (error) {
      logger.warn(error, "in updateRemote().timeout");
    }
  } catch (error) {
    logger.warn(error, "In updateRemote():");
  } finally {
    refreshRemote(interaction);
  }
  //checking API call interval
  if (!getLeaderId()) {
    if (updateIntervalId) clearInterval(updateIntervalId);
    updateOnInterval = false;
  }
}

function setUpdateInterval(interaction) {
  logger.info("Setting update interval");
  if (updateOnInterval) {
    const db = new StormDB(Engine);
    if (updateIntervalId) clearInterval(updateIntervalId);
    const delay = db.get("options.updaterate").value();
    logger.debug(`setting an update interval of ${delay} milliseconds`);
    updateIntervalId = setInterval(updateRemote, delay, interaction);
  }
}

async function remote(interaction) {
  await updateRemote(interaction);
  setUpdateInterval(interaction);
  refreshOnce = false;
  refreshRemote(interaction);
}

async function onTrackChange(interaction) {
  logger.debug("track change update");
  timeoutId = 0;
  timeoutDelay = 0;
  refreshOnce = false;
  await refreshRemote(interaction);
}

function getSearchOffset(value) {
  if (arguments.length > 0) searchOffset = value;
  return searchOffset;
}

function getSearchIndex(value) {
  if (arguments.length > 0) searchIndex = value;
  return searchIndex;
}

function getIsSearching(value) {
  if (arguments.length > 0) isSearching = value;
  return isSearching;
}

async function getSearchData(interaction, query) {
  const options = {
    limit: searchSize,
    offset: searchIndex + searchOffset,
  };
  const spotifyApi = new SpotifyWebApi();
  try {
    const token = await getToken(interaction.user.id);
    if (!token) throw "No token provided";
    spotifyApi.setAccessToken(token);
    const data = await spotifyApi.search(query, ["track"], options);
    validateResponse(data, true);
    if (!data.body.tracks.items.length) throw "no tracks found";
    let res = {
      tracks: [],
      offset: data.body.tracks.offset,
      total: data.body.tracks.total,
    };
    data.body.tracks.items.forEach((track) => {
      track.artists = track.artists.map((obj) => obj.name).join();
      track.cover = track.album?.images?.[0]?.url;
      res.tracks.push(track);
    });
    res.query = query;
    searchData = res;
    return res;
  } catch (error) {
    logger.error(error, "in getSearchData():");
    isSearching = false;
  } finally {
    spotifyApi.resetAccessToken();
  }
}

function searchMessage(interaction, data, once) {
  if (!data || !data.tracks.length)
    return { embeds: [{ description: "no tracks found" }] };
  const track = data.tracks[searchIndex];
  const embed = new MessageEmbed()
    .setTitle(`\`\`\`${track.name} by ${track.artists}\`\`\``)
    .setDescription(
      once
        ? `Added by <@${interaction.user.id}>`
        : `${searchIndex + searchOffset + 1} of ${data.total}`
    )
    .setThumbnail(track.cover);

  const controls = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId("previousSearch")
      .setLabel("⬅️")
      .setStyle("SECONDARY")
      .setDisabled(!searchIndex && !searchOffset),
    new MessageButton()
      .setCustomId("nextSearch")
      .setLabel("➡️")
      .setStyle("SECONDARY")
      .setDisabled(searchIndex + searchOffset == data.total),
    new MessageButton()
      .setCustomId("confirmSearch")
      .setLabel("🙋")
      .setStyle("SECONDARY"),
    new MessageButton()
      .setCustomId("cancelSearch")
      .setLabel("🙅")
      .setStyle("SECONDARY")
  );
  let message = { embeds: [embed], components: [] };
  if (!once) message.components = [controls];
  return message;
}

async function updateSearch(interaction) {
  let data;
  if (searchIndex < 0 && searchOffset == 0) searchIndex = 0;
  if (0 <= searchIndex && searchIndex < searchSize) data = searchData;
  else {
    if (searchIndex >= searchSize) {
      searchOffset += searchSize;
      searchIndex = 0;
      data = await getSearchData(interaction, searchData.query);
    } else if (searchIndex < 0) {
      searchOffset -= searchSize;
      searchIndex = 0;
      data = await getSearchData(interaction, searchData.query);
      searchIndex = searchSize - 1;
    } else data = await getSearchData(interaction, searchData.query);
  }
  const message = searchMessage(interaction, data, false);
  await interaction.editReply(message);
}

function getPlaylistOwner() {
  if (!state?.[0]?.playlist?.owner) return;
  return state.find((user) => user.accountId === state[0].playlist.owner)
    ?.userId;
}

async function addToPlaylist(uri) {
  const spotifyApi = new SpotifyWebApi();
  try {
    const userId = getPlaylistOwner();
    if (!userId) throw "Can't find playlist owner";
    const token = await getToken(userId);
    if (!token) throw "No token provided";
    spotifyApi.setAccessToken(token);
    validateResponse(
      await spotifyApi.addTracksToPlaylist(state[0].playlist.id, [uri])
    );
    queue = await getQueue(state[0], 10);
  } catch (error) {
    logger.error(error, "In addToPlaylist():");
  } finally {
    spotifyApi.resetAccessToken();
    refreshOnce = false;
  }
}

async function addSearchedSong(interaction) {
  const uri = searchData.tracks[searchIndex].uri;
  try {
    await addToPlaylist(uri);
    const message = searchMessage(interaction, searchData, true);
    await interaction.editReply(message);
  } catch (error) {
    logger.error(error, "in addSearchingSong():");
    interaction.editReply({
      embeds: [{ description: "failed to add track" }],
      components: [],
    });
  }
}

function isListener(userId) {
  return listening.includes(userId);
}

function isAuthenticated(userId) {
  const db = new StormDB(Engine);
  const userIds = Object.keys(db.get("authenticated").value());
  return userIds.includes(userId);
}

async function addListener(interaction, userId) {
  logger.debug("Adding listener " + userId);
  listening.push(userId);
  usernames[userId] = await getUsername(interaction, userId);
  updateOnInterval = true;
  refreshOnce = false;
  const spotifyApi = new SpotifyWebApi();
  try {
    const token = await getToken(userId);
    if (!token) throw "No token provided";
    spotifyApi.setAccessToken(token);
    const data = await spotifyApi.getMe();
    validateResponse(data, true);
    accounts[userId] = data.body.id;
  } catch (error) {
    logger.warn(error, "in addListener().playlist");
  } finally {
    spotifyApi.resetAccessToken();
  }
}

function removeListener(userId) {
  logger.debug("Removing listener " + userId);
  listening = listening.filter((user) => user != userId);
  logger.debug(listening);
  syncing[userId] = false;
  refreshOnce = false;
}

module.exports = {
  isAuthenticated,
  isListener,
  addListener,
  removeListener,
  postGuide,
  getToken,
  apiError,
  validateResponse,
  getPlayingTrack,
  isSaved,
  getLastMessage,
  setLastMessage,
  getLeaderId,
  getListening,
  getUserData,
  remote,
  refreshRemote,
  remoteMessage,
  getQueue,
  getUser,
  getSearchData,
  getSearchIndex,
  getSearchOffset,
  getIsSearching,
  getRefreshOnce,
  searchMessage,
  updateSearch,
  addSearchedSong,
  addToPlaylist,
  getPlaylistOwner,
  getPlaybackData,
  inactiveMessage,
  blankMessage,
  failedMessage,
  newMessage,
};
