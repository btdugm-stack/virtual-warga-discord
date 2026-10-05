/**
 * The Discord gateway connection. Translates gateway events into World calls and nothing else.
 *
 * Privileged intents needed in the Developer Portal: Presence and Server Members.
 * Message Content is deliberately not requested: the office only shows that someone wrote, never what.
 *
 * It also registers the `/karakter` and `/emote` commands and passes their interactions to the files that
 * answer them.
 */
import { ActivityType, ChannelType, Client, Events, GatewayIntentBits, MessageFlags, Partials } from "discord.js";
import { EMOTE_COMMAND, handleEmote } from "./emote-command.mjs";
import { KARAKTER_COMMAND, handleKarakter } from "./karakter-command.mjs";

const CHANNEL_KINDS = new Map([
  [ChannelType.GuildText, "text"],
  [ChannelType.GuildAnnouncement, "text"],
  [ChannelType.GuildForum, "text"],
  [ChannelType.GuildVoice, "voice"],
  [ChannelType.GuildStageVoice, "voice"],
]);

/**
 * Offline members are only known by asking for the whole member list. Above this size that request is slow
 * and the AFK room could not seat them anyway, so such a server shows only its active members.
 */
const MEMBER_LIST_MAX = 2000;

/** Sent to browsers as-is: small, and drawn pixelated to sit with the pixel art. */
const AVATAR_SIZE = 32;

/**
 * The activities worth showing, most specific first. A custom status is left out on purpose: it is free text
 * the member wrote for their Discord friends, not for a public page.
 */
const ACTIVITY_KINDS = [
  [ActivityType.Streaming, "stream"],
  [ActivityType.Playing, "play"],
  [ActivityType.Competing, "compete"],
  [ActivityType.Listening, "listen"],
  [ActivityType.Watching, "watch"],
];

/** Only the activity's name is taken ("Valorant", "Spotify"), never its details such as the song or stream title. */
function activityOf(presence) {
  for (const [type, kind] of ACTIVITY_KINDS) {
    const activity = presence.activities.find((candidate) => candidate.type === type);
    if (activity?.name) return { kind, name: activity.name };
  }
  return null;
}

/** The one thing worth showing about how someone is in a call. */
function voiceStateOf(state) {
  if (state.streaming) return "live";
  if (state.selfVideo) return "video";
  if (state.deaf) return "deaf";
  if (state.mute) return "mute";
  return null;
}

/** Gateway close code 4014, as discord.js reports it. */
const DISALLOWED_INTENTS = /disallowed intents/i;

export function startDiscord(world, token, characters, siteLinkFor) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageTyping,
      GatewayIntentBits.GuildMessageReactions,
    ],
    // Without these, a reaction on a message sent before the bot started is silently dropped.
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  });
  const fetching = new Set();

  /**
   * A presence can arrive for a member the cache has never seen in full. Return what is known now and
   * look the member up once in the background; the name is corrected when that returns.
   */
  const nameOf = (guild, userId) => {
    const member = guild.members.cache.get(userId);
    if (member?.user?.username) return member.displayName;
    const user = client.users.cache.get(userId);
    const key = `${guild.id}:${userId}`;
    if (!fetching.has(key)) {
      fetching.add(key);
      guild.members.fetch(userId)
        .then((fetched) => (fetched.user.bot ? world.dropUser(userId) : world.setName(userId, fetched.displayName)))
        .catch(() => {})
        .finally(() => fetching.delete(key));
    }
    return user?.username ? user.globalName ?? user.username : null;
  };

  const isBot = (userId) => client.users.cache.get(userId)?.bot === true;

  const syncChannel = (channel) => {
    const type = CHANNEL_KINDS.get(channel.type);
    // `viewable` is false when the bot's roles are denied View Channel there: Discord then sends it nothing
    // that happens in the channel, so a room bound to it would stay empty without saying why.
    if (type && channel.guildId) world.setChannel(channel.guildId, { id: channel.id, name: channel.name, type, viewable: channel.viewable });
  };

  const syncGuild = (guild) => {
    guild.commands.set([KARAKTER_COMMAND, EMOTE_COMMAND])
      .catch((error) => console.error(`[discord] gagal mendaftarkan perintah di ${guild.name}: ${error.message}`));
    world.setGuild(guild.id, guild.name);
    guild.channels.cache.forEach(syncChannel);
    guild.presences.cache.forEach((presence) => {
      if (presence.status === "offline" || isBot(presence.userId)) return;
      world.setPresence(guild.id, presence.userId, presence.status, nameOf(guild, presence.userId), { silent: true });
      world.setActivity(presence.userId, activityOf(presence));
    });
    guild.voiceStates.cache.forEach((state) => {
      if (!state.channelId || isBot(state.id)) return;
      world.setVoice(guild.id, state.id, state.channelId, nameOf(guild, state.id), { silent: true, state: voiceStateOf(state) });
    });
    if (guild.memberCount > MEMBER_LIST_MAX) {
      console.warn(`[discord] ${guild.name}: ${guild.memberCount} anggota, daftar offline tidak dimuat.`);
      return;
    }
    guild.members.fetch()
      .then((members) => members.forEach((member) => {
        if (!member.user.bot) world.addMember(guild.id, member.id, member.displayName);
      }))
      .catch((error) => console.error(`[discord] gagal memuat anggota ${guild.name}: ${error.message}`));
  };

  client.once(Events.ClientReady, (ready) => {
    world.botName = ready.user.username;
    ready.guilds.cache.forEach(syncGuild);
    world.setStatus("ready");
    console.log(`[discord] masuk sebagai ${ready.user.tag}, ${ready.guilds.cache.size} server`);
  });

  client.on(Events.GuildCreate, syncGuild);
  client.on(Events.GuildUpdate, (_old, guild) => world.setGuild(guild.id, guild.name));
  client.on(Events.GuildDelete, (guild) => world.removeGuild(guild.id));
  client.on(Events.ChannelCreate, syncChannel);
  client.on(Events.ChannelUpdate, (_old, channel) => syncChannel(channel));
  // What the bot may see can change without any channel changing: its roles, or a role's permissions.
  const resyncChannels = (guild) => guild.channels.cache.forEach(syncChannel);
  client.on(Events.GuildRoleUpdate, (_old, role) => resyncChannels(role.guild));
  client.on(Events.GuildMemberUpdate, (_old, member) => {
    if (member.id === client.user?.id) resyncChannels(member.guild);
  });
  client.on(Events.ChannelDelete, (channel) => {
    if (channel.guildId) world.removeChannel(channel.guildId, channel.id);
  });

  client.on(Events.PresenceUpdate, (_old, presence) => {
    if (!presence.guild || isBot(presence.userId)) return;
    const name = presence.status === "offline" ? null : nameOf(presence.guild, presence.userId);
    world.setPresence(presence.guild.id, presence.userId, presence.status, name);
    world.setActivity(presence.userId, presence.status === "offline" ? null : activityOf(presence));
  });
  client.on(Events.GuildMemberAdd, (member) => {
    if (!member.user.bot) world.addMember(member.guild.id, member.id, member.displayName);
  });
  client.on(Events.GuildMemberUpdate, (_old, member) => world.setName(member.id, member.displayName));
  client.on(Events.GuildMemberRemove, (member) => world.removeMember(member.guild.id, member.id));

  client.on(Events.VoiceStateUpdate, (_old, state) => {
    if (isBot(state.id)) return;
    world.setVoice(state.guild.id, state.id, state.channelId, nameOf(state.guild, state.id), { state: voiceStateOf(state) });
  });

  client.on(Events.MessageCreate, (message) => {
    if (!message.guild || message.author.bot || message.system || message.webhookId) return;
    // A thread counts as its parent channel: rooms are bound to channels, not threads.
    const channelId = message.channel.isThread() ? message.channel.parentId : message.channelId;
    if (!channelId) return;
    world.noteChat(message.guild.id, message.author.id, channelId, message.member?.displayName ?? message.author.username);
  });

  client.on(Events.TypingStart, (typing) => {
    if (!typing.guild || typing.user.bot) return;
    const channelId = typing.channel.isThread() ? typing.channel.parentId : typing.channel.id;
    if (channelId) world.noteTyping(typing.guild.id, typing.user.id, channelId, nameOf(typing.guild, typing.user.id));
  });

  client.on(Events.MessageReactionAdd, (reaction, user) => {
    const guild = reaction.message.guild;
    if (!guild || user.bot) return;
    const { id, name } = reaction.emoji;
    // A server's own emoji is a picture; a standard one is the character itself.
    const emoji = id ? { image: `https://cdn.discordapp.com/emojis/${id}.webp?size=32` } : name ? { text: name } : null;
    if (emoji) world.noteReaction(guild.id, user.id, emoji, nameOf(guild, user.id));
  });

  client.on(Events.UserUpdate, () => world.touch());

  client.on(Events.InteractionCreate, (interaction) => {
    const answered = async () => (await handleKarakter(interaction, characters, () => world.touch(), siteLinkFor)) || handleEmote(interaction, world);
    answered().catch((error) => {
      console.error(`[discord] perintah gagal: ${error.message}`);
      // Discord shows "interaction failed" unless something is sent back; say so in words instead.
      // Once acknowledged, a follow-up is the way to add a message without touching the picker.
      if (!interaction.isRepliable()) return;
      const sorry = { content: "Maaf, ada gangguan. Coba jalankan perintahnya lagi.", flags: MessageFlags.Ephemeral };
      (interaction.deferred || interaction.replied ? interaction.followUp(sorry) : interaction.reply(sorry)).catch(() => {});
    });
  });

  client.on(Events.ShardDisconnect, () => world.setStatus("connecting"));
  client.on(Events.ShardReconnecting, () => world.setStatus("connecting"));
  client.on(Events.ShardResume, () => world.setStatus("ready"));
  client.on(Events.Error, (error) => console.error("[discord]", error.message));

  client.login(token).catch((error) => {
    const code = error.code === "TokenInvalid" ? "token" : DISALLOWED_INTENTS.test(error.message) ? "intents" : "unknown";
    console.error(
      code === "token"
        ? "[discord] DISCORD_TOKEN ditolak. Salin ulang token bot dari Developer Portal."
        : code === "intents"
          ? "[discord] Intent ditolak. Aktifkan Presence Intent dan Server Members Intent di Developer Portal → Bot."
          : `[discord] gagal masuk: ${error.message}`,
    );
    world.setStatus("error", code);
  });

  return {
    /** The member's own profile picture, or null when they never set one (the default Discord logo is not a face). */
    avatarUrl: (userId) => client.users.cache.get(userId)?.avatarURL({ extension: "png", size: AVATAR_SIZE, forceStatic: true }) ?? null,
  };
}
