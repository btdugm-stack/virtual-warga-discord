/**
 * The live picture of Discord that the office is drawn from. Both the real gateway source and the demo
 * source write here through the same methods, so the snapshot rules below are the only place that decides
 * who sits in which room.
 *
 * Message text never enters this file: a chat is recorded as "this user, this channel, this time".
 */

export const SLOT_COUNT = 9;
/** People sent per room. The floor has fewer seats than a big server has members; the rest become "+N". */
export const ROOM_CAP = 24;
/** How long "Sedang Gibah di #channel" stays over someone's head after their last message. */
export const CHAT_BUBBLE_MS = 60_000;
/** How long a chatter stays in a text-channel room after their last message. */
export const CHAT_ROOM_MS = 5 * 60_000;
/** One feed line per person per channel in this window, so a fast conversation does not flood the feed. */
const CHAT_FEED_GAP_MS = 3 * 60_000;
const FEED_MAX = 60;

/** Seating priority inside a room: whoever is doing something is shown before whoever is just present. */
const STATUS_RANK = { online: 2, dnd: 3, idle: 4, offline: 5 };

export class World {
  constructor(onChange = () => {}) {
    this.onChange = onChange;
    this.status = "connecting";
    this.errorCode = "";
    this.botName = "";
    this.demo = false;
    /** @type {Map<string, {id: string, name: string, channels: Map<string, {id: string, name: string, type: "text" | "voice"}>}>} */
    this.guilds = new Map();
    /** @type {Map<string, {name: string, status: string, announced: string, guilds: Set<string>}>} */
    this.users = new Map();
    /** @type {Map<string, {guildId: string, channelId: string}>} */
    this.voice = new Map();
    /** @type {Map<string, {guildId: string, channelId: string, at: number}>} */
    this.chats = new Map();
    this.chatFeedAt = new Map();
    this.feed = [];
    this.feedSeq = 0;
    /** Guilds some room is bound to. Activity elsewhere is tracked but never reaches the feed. */
    this.relevant = new Set();
  }

  /** Something outside this file changed what the snapshot shows (a chosen character, a new profile picture). */
  touch() {
    this.onChange();
  }

  setStatus(status, errorCode = "") {
    this.status = status;
    this.errorCode = errorCode;
    this.onChange();
  }

  setGuild(id, name) {
    const guild = this.guilds.get(id);
    if (guild) guild.name = name;
    else this.guilds.set(id, { id, name, channels: new Map() });
    this.onChange();
  }

  removeGuild(id) {
    this.guilds.delete(id);
    for (const [userId, user] of this.users) {
      user.guilds.delete(id);
      if (!user.guilds.size) this.dropUser(userId);
    }
    for (const [userId, at] of this.voice) if (at.guildId === id) this.voice.delete(userId);
    for (const [userId, at] of this.chats) if (at.guildId === id) this.chats.delete(userId);
    this.onChange();
  }

  setChannel(guildId, channel) {
    this.guilds.get(guildId)?.channels.set(channel.id, channel);
    this.onChange();
  }

  removeChannel(guildId, channelId) {
    this.guilds.get(guildId)?.channels.delete(channelId);
    this.onChange();
  }

  /** `silent` is for the first sync after connecting: everyone already online is not news. */
  setPresence(guildId, userId, status, name, { silent = false } = {}) {
    let user = this.users.get(userId);
    if (status === "offline") {
      if (!user) return;
      if (!silent && user.announced !== "offline" && this.#userRelevant(user)) this.#log("offline", user.name);
      // Offline members stay known: they wait in the AFK room until they come back.
      // Forget their last chat, or they would linger in that channel's room for minutes after leaving.
      this.chats.delete(userId);
      user.status = "offline";
      user.announced = "offline";
      this.onChange();
      return;
    }
    if (!user) {
      user = { name: name ?? "Warga", status, announced: "offline", guilds: new Set() };
      this.users.set(userId, user);
    }
    if (name) user.name = name;
    user.status = status;
    user.guilds.add(guildId);
    if (silent) user.announced = status;
    else if (user.announced !== status && this.#userRelevant(user)) {
      this.#log(status, user.name);
      user.announced = status;
    }
    this.onChange();
  }

  /** A member of the server, whatever their status. Never changes the status of someone already known. */
  addMember(guildId, userId, name) {
    this.#ensureUser(guildId, userId, name);
    this.onChange();
  }

  setName(userId, name) {
    const user = this.users.get(userId);
    if (!user || user.name === name) return;
    user.name = name;
    this.onChange();
  }

  removeMember(guildId, userId) {
    const user = this.users.get(userId);
    if (!user) return;
    user.guilds.delete(guildId);
    if (this.voice.get(userId)?.guildId === guildId) this.voice.delete(userId);
    if (this.chats.get(userId)?.guildId === guildId) this.chats.delete(userId);
    if (!user.guilds.size) this.dropUser(userId);
    this.onChange();
  }

  dropUser(userId) {
    this.users.delete(userId);
    this.voice.delete(userId);
    this.chats.delete(userId);
    this.onChange();
  }

  setVoice(guildId, userId, channelId, name, { silent = false } = {}) {
    const previous = this.voice.get(userId);
    if ((previous?.channelId ?? null) === channelId) return;
    const user = this.#ensureUser(guildId, userId, name);
    if (channelId) this.voice.set(userId, { guildId, channelId });
    else this.voice.delete(userId);
    if (!silent && this.relevant.has(guildId)) {
      if (channelId) this.#log(previous ? "voice_move" : "voice_join", user.name, this.#channelName(guildId, channelId));
      else if (previous) this.#log("voice_leave", user.name, this.#channelName(previous.guildId, previous.channelId));
    }
    this.onChange();
  }

  noteChat(guildId, userId, channelId, name, now = Date.now()) {
    const user = this.#ensureUser(guildId, userId, name);
    this.chats.set(userId, { guildId, channelId, at: now });
    const feedKey = `${userId}:${channelId}`;
    if (this.relevant.has(guildId) && now - (this.chatFeedAt.get(feedKey) ?? 0) > CHAT_FEED_GAP_MS) {
      this.chatFeedAt.set(feedKey, now);
      this.#log("chat", user.name, this.#channelName(guildId, channelId));
    }
    this.onChange();
  }

  /** Expire chats that are too old to count. */
  sweep(now = Date.now()) {
    for (const [userId, chat] of this.chats) if (now - chat.at >= CHAT_ROOM_MS) this.chats.delete(userId);
    for (const [key, at] of this.chatFeedAt) if (now - at >= CHAT_FEED_GAP_MS) this.chatFeedAt.delete(key);
  }

  setRelevant(slots) {
    this.relevant = new Set(slots.flatMap((slot) => (slot.kind === "guild" || slot.kind === "channel" ? [slot.guildId] : [])));
  }

  /** What the settings screen picks from. Admin only: it lists every server and channel the bot can see. */
  catalog() {
    return [...this.guilds.values()]
      .map((guild) => ({
        id: guild.id,
        name: guild.name,
        channels: [...guild.channels.values()].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * The public view. One person appears in exactly one room, chosen in this order: the voice channel they are in,
   * the text channel they last wrote in, the AFK room when idle or offline, then the first room bound to a server
   * of theirs. Offline members are shown only in the AFK room; without one they are not shown at all.
   */
  snapshot(slots, publicId, lookOf = () => ({}), now = Date.now()) {
    const voiceRoom = new Map();
    const textRoom = new Map();
    const guildRoom = new Map();
    let idleRoom = -1;
    const rooms = slots.map((slot, index) => {
      const room = { kind: slot.kind, title: slot.label ?? "", subtitle: "", missing: false, total: 0, overflow: 0, live: false };
      if (slot.kind === "idle") {
        if (idleRoom < 0) idleRoom = index;
      } else if (slot.kind === "guild") {
        const guild = this.guilds.get(slot.guildId);
        if (!guild) room.missing = true;
        else {
          room.title ||= guild.name;
          if (!guildRoom.has(guild.id)) guildRoom.set(guild.id, index);
        }
      } else if (slot.kind === "channel") {
        const guild = this.guilds.get(slot.guildId);
        const channel = guild?.channels.get(slot.channelId);
        if (!guild || !channel) room.missing = true;
        else {
          room.title ||= channel.type === "voice" ? channel.name : `#${channel.name}`;
          room.subtitle = guild.name;
          const target = channel.type === "voice" ? voiceRoom : textRoom;
          if (!target.has(channel.id)) target.set(channel.id, index);
        }
      }
      return room;
    });

    const seated = rooms.map(() => []);
    for (const [userId, user] of this.users) {
      const voice = this.voice.get(userId);
      const chat = this.chats.get(userId);
      const chatting = chat && now - chat.at < CHAT_ROOM_MS ? chat : undefined;
      // "Offline" while in voice or just after writing is someone invisible; they are placed like anyone active.
      const gone = user.status === "offline" && !voice && !chatting;
      let room = voice ? voiceRoom.get(voice.channelId) : undefined;
      if (room === undefined && chatting) room = textRoom.get(chatting.channelId);
      if (room === undefined && (gone || user.status === "idle") && idleRoom >= 0 && this.#userRelevant(user)) room = idleRoom;
      if (room === undefined && gone) continue;
      if (room === undefined) {
        for (const guildId of user.guilds) {
          const candidate = guildRoom.get(guildId);
          if (candidate !== undefined && (room === undefined || candidate < room)) room = candidate;
        }
      }
      if (room === undefined) continue;
      const voiceName = voice && this.relevant.has(voice.guildId) ? this.#channelName(voice.guildId, voice.channelId) : null;
      const chatName = chatting && now - chatting.at < CHAT_BUBBLE_MS && this.relevant.has(chatting.guildId)
        ? this.#channelName(chatting.guildId, chatting.channelId)
        : null;
      seated[room].push({
        id: publicId(userId),
        name: user.name,
        presence: user.status,
        room,
        voice: voiceName,
        chat: chatName,
        ...lookOf(userId),
        rank: voiceName ? 0 : chatName ? 1 : STATUS_RANK[user.status] ?? 5,
      });
    }

    const members = [];
    seated.forEach((list, index) => {
      list.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
      rooms[index].total = list.length;
      rooms[index].overflow = Math.max(0, list.length - ROOM_CAP);
      rooms[index].live = list.some(({ rank }) => rank < 2);
      for (const { rank: _rank, ...member } of list.slice(0, ROOM_CAP)) members.push(member);
    });

    return {
      status: this.status,
      errorCode: this.errorCode,
      demo: this.demo,
      botName: this.botName,
      rooms,
      members,
      feed: this.feed,
    };
  }

  #ensureUser(guildId, userId, name) {
    let user = this.users.get(userId);
    if (!user) {
      user = { name: name ?? "Warga", status: "offline", announced: "offline", guilds: new Set() };
      this.users.set(userId, user);
    }
    if (name) user.name = name;
    user.guilds.add(guildId);
    return user;
  }

  #userRelevant(user) {
    for (const guildId of user.guilds) if (this.relevant.has(guildId)) return true;
    return false;
  }

  #channelName(guildId, channelId) {
    return this.guilds.get(guildId)?.channels.get(channelId)?.name ?? "?";
  }

  #log(kind, name, where = "") {
    this.feedSeq += 1;
    this.feed = [{ id: this.feedSeq, at: new Date().toISOString(), kind, name, where }, ...this.feed].slice(0, FEED_MAX);
  }
}
