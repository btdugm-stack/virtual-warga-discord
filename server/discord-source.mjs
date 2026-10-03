/**
 * The Discord gateway connection. Translates gateway events into World calls and nothing else.
 *
 * Privileged intents needed in the Developer Portal: Presence and Server Members.
 * Message Content is deliberately not requested: the office only shows that someone wrote, never what.
 */
import { ChannelType, Client, Events, GatewayIntentBits } from "discord.js";

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

/** Gateway close code 4014, as discord.js reports it. */
const DISALLOWED_INTENTS = /disallowed intents/i;

export function startDiscord(world, token) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
    ],
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
    if (type && channel.guildId) world.setChannel(channel.guildId, { id: channel.id, name: channel.name, type });
  };

  const syncGuild = (guild) => {
    world.setGuild(guild.id, guild.name);
    guild.channels.cache.forEach(syncChannel);
    guild.presences.cache.forEach((presence) => {
      if (presence.status === "offline" || isBot(presence.userId)) return;
      world.setPresence(guild.id, presence.userId, presence.status, nameOf(guild, presence.userId), { silent: true });
    });
    guild.voiceStates.cache.forEach((state) => {
      if (!state.channelId || isBot(state.id)) return;
      world.setVoice(guild.id, state.id, state.channelId, nameOf(guild, state.id), { silent: true });
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
  client.on(Events.ChannelDelete, (channel) => {
    if (channel.guildId) world.removeChannel(channel.guildId, channel.id);
  });

  client.on(Events.PresenceUpdate, (_old, presence) => {
    if (!presence.guild || isBot(presence.userId)) return;
    const name = presence.status === "offline" ? null : nameOf(presence.guild, presence.userId);
    world.setPresence(presence.guild.id, presence.userId, presence.status, name);
  });
  client.on(Events.GuildMemberAdd, (member) => {
    if (!member.user.bot) world.addMember(member.guild.id, member.id, member.displayName);
  });
  client.on(Events.GuildMemberUpdate, (_old, member) => world.setName(member.id, member.displayName));
  client.on(Events.GuildMemberRemove, (member) => world.removeMember(member.guild.id, member.id));

  client.on(Events.VoiceStateUpdate, (_old, state) => {
    if (isBot(state.id)) return;
    world.setVoice(state.guild.id, state.id, state.channelId, nameOf(state.guild, state.id));
  });

  client.on(Events.MessageCreate, (message) => {
    if (!message.guild || message.author.bot || message.system || message.webhookId) return;
    // A thread counts as its parent channel: rooms are bound to channels, not threads.
    const channelId = message.channel.isThread() ? message.channel.parentId : message.channelId;
    if (!channelId) return;
    world.noteChat(message.guild.id, message.author.id, channelId, message.member?.displayName ?? message.author.username);
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

  return client;
}
