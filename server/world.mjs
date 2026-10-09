/**
 * The live picture of Discord that the office is drawn from. Both the real gateway source and the demo
 * source write here through the same methods, so the snapshot rules below are the only place that decides
 * who sits in which room.
 *
 * Message text never enters this file: a chat is recorded as "this user, this channel, this time".
 */

export const SLOT_COUNT = 9;
/**
 * The room number of the corridor. It is not a slot and cannot be bound: it is where someone active stands
 * when no room fits them, so that being online in a shown server always puts a character on the floor.
 */
export const CORRIDOR = SLOT_COUNT;
/** People sent per room. The floor has fewer seats than a big server has members; the rest become "+N". */
export const ROOM_CAP = 24;
/** How long "Sedang Gibah di #channel" stays over someone's head after their last message. */
export const CHAT_BUBBLE_MS = 6_000;
/** How long a chatter stays in a text-channel room after their last message. */
export const CHAT_ROOM_MS = 2 * 60_000;
/** One feed line per person per channel in this window, so a fast conversation does not flood the feed. */
const CHAT_FEED_GAP_MS = 2 * 60_000;
const FEED_MAX = 60;
/** Discord shows "is typing" for about this long after the last keystroke it reports. */
const TYPING_MS = 3_000;
/** How long a reaction's emoji is kept for the office to float over the member's head. */
const REACTION_MS = 6_000;
/** How long a character keeps doing an emote. */
export const EMOTE_MS = 8_000;
/** A game or stream title can be any length; the nameplate cannot. */
const ACTIVITY_NAME_MAX = 40;

/** Seating priority inside a room: whoever is doing something is shown before whoever is just present. */
const STATUS_RANK = { online: 2, dnd: 3, idle: 4, offline: 5 };

export class World {
  constructor(onChange = () => {}) {
    this.onChange = onChange;
    this.status = "connecting";
    this.errorCode = "";
    this.botName = "";
    this.demo = false;
    /** `viewable` is false for a channel the bot is not allowed to see into. */
    /** @type {Map<string, {id: string, name: string, channels: Map<string, {id: string, name: string, type: "text" | "voice", viewable?: boolean}>}>} */
    this.guilds = new Map();
    /** @type {Map<string, {name: string, status: string, announced: string, guilds: Set<string>, activity?: {kind: string, name: string} | null}>} */
    this.users = new Map();
    /** `state` is the one thing worth showing about how they are in the call: live, video, deaf, mute, or null. */
    /** @type {Map<string, {guildId: string, channelId: string, state: string | null}>} */
    this.voice = new Map();
    /** @type {Map<string, {guildId: string, channelId: string, at: number}>} */
    this.chats = new Map();
    this.chatFeedAt = new Map();
    /*
     * Things that last a few seconds and then end on their own: typing, a reaction, an emote. Each entry
     * removes itself when its time is up, so the office is told the moment it ends, not at the next sweep.
     */
    /** @type {Map<string, {guildId: string, channelId: string}>} */
    this.typing = new Map();
    /** @type {Map<string, {id: number, text?: string, image?: string}>} */
    this.reactions = new Map();
    /** @type {Map<string, {id: number, kind: string}>} */
    this.emotes = new Map();
    this.momentSeq = 0;
    /** Each server's member levels, as last read from its leaderboard. @type {Map<string, Map<string, number>>} */
    this.levels = new Map();
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
      this.typing.delete(userId);
      user.activity = null;
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

  /**
   * What the member's Discord status says they are doing: `{ kind, name }`, kind being play, stream, listen,
   * watch, or compete. Whether it is shown is the member's choice and is decided when the snapshot is built.
   */
  setActivity(userId, activity) {
    const user = this.users.get(userId);
    if (!user) return;
    const next = activity ? { kind: activity.kind, name: activity.name.slice(0, ACTIVITY_NAME_MAX) } : null;
    if ((user.activity?.kind ?? "") === (next?.kind ?? "") && (user.activity?.name ?? "") === (next?.name ?? "")) return;
    user.activity = next;
    this.onChange();
  }

  /** Replace what is known of one server's levels (user id → level). */
  setLevels(guildId, levels) {
    this.levels.set(guildId, levels);
    this.onChange();
  }

  /** A member's level: the highest among the shown servers they are in, or null when none of them has one. */
  #levelOf(userId, user) {
    let best = null;
    for (const guildId of user.guilds) {
      const level = this.relevant.has(guildId) ? this.levels.get(guildId)?.get(userId) : undefined;
      if (level !== undefined && (best === null || level > best)) best = level;
    }
    return best;
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
    this.typing.delete(userId);
    this.reactions.delete(userId);
    this.emotes.delete(userId);
    this.onChange();
  }

  setVoice(guildId, userId, channelId, name, { silent = false, state = null } = {}) {
    const previous = this.voice.get(userId);
    if ((previous?.channelId ?? null) === channelId) {
      // Same channel: at most the mute, deafen, stream, or camera state changed.
      if (previous && previous.state !== state) {
        previous.state = state;
        this.onChange();
      }
      return;
    }
    const user = this.#ensureUser(guildId, userId, name);
    if (channelId) this.voice.set(userId, { guildId, channelId, state });
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
    // The message they were typing has been sent.
    this.typing.delete(userId);
    const feedKey = `${userId}:${channelId}`;
    if (this.relevant.has(guildId) && now - (this.chatFeedAt.get(feedKey) ?? 0) > CHAT_FEED_GAP_MS) {
      this.chatFeedAt.set(feedKey, now);
      this.#log("chat", user.name, this.#channelName(guildId, channelId));
    }
    this.onChange();
  }

  noteTyping(guildId, userId, channelId, name) {
    this.#ensureUser(guildId, userId, name);
    this.#briefly(this.typing, userId, { guildId, channelId }, TYPING_MS);
  }

  /** `emoji` is `{ text }` for a standard emoji or `{ image }` (an address) for a server's own. Which message it was on is not kept. */
  noteReaction(guildId, userId, emoji, name) {
    this.#ensureUser(guildId, userId, name);
    if (!this.relevant.has(guildId)) return;
    this.#briefly(this.reactions, userId, { id: (this.momentSeq += 1), ...emoji }, REACTION_MS);
  }

  /** Returns false when the member is not someone the office knows, so the command can say so. */
  setEmote(userId, kind) {
    if (!this.users.has(userId)) return false;
    this.#briefly(this.emotes, userId, { id: (this.momentSeq += 1), kind }, EMOTE_MS);
    return true;
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
   * the channel they last wrote in, the AFK room when idle or offline, then the first room bound to a server
   * of theirs. An active member of a shown server whom none of that places stands in the corridor: with only
   * channels bound, that is everyone who is online but not in one of them right now.
   * Offline members are shown only in the AFK room; without one they are not shown at all.
   */
  snapshot(slots, publicId, profileOf = () => ({}), now = Date.now()) {
    const voiceRoom = new Map();
    const textRoom = new Map();
    const guildRoom = new Map();
    let idleRoom = -1;
    const rooms = slots.map((slot, index) => {
      const room = { kind: slot.kind, title: slot.label ?? "", subtitle: "", missing: false, blocked: false, total: 0, overflow: 0, live: false };
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
          room.blocked = channel.viewable === false;
          const target = channel.type === "voice" ? voiceRoom : textRoom;
          if (!target.has(channel.id)) target.set(channel.id, index);
        }
      }
      return room;
    });

    // One list per room, and one more for the corridor.
    const seated = Array.from({ length: rooms.length + 1 }, () => []);
    for (const [userId, user] of this.users) {
      const voice = this.voice.get(userId);
      const chat = this.chats.get(userId);
      const chatting = chat && now - chat.at < CHAT_ROOM_MS ? chat : undefined;
      // "Offline" while in voice or just after writing is someone invisible; they are placed like anyone active.
      const gone = user.status === "offline" && !voice && !chatting;
      let room = voice ? voiceRoom.get(voice.channelId) : undefined;
      // A voice channel has a chat of its own; writing there belongs to that channel's room too.
      if (room === undefined && chatting) room = textRoom.get(chatting.channelId) ?? voiceRoom.get(chatting.channelId);
      if (room === undefined && (gone || user.status === "idle") && idleRoom >= 0 && this.#userRelevant(user)) room = idleRoom;
      if (room === undefined && gone) continue;
      if (room === undefined) {
        for (const guildId of user.guilds) {
          const candidate = guildRoom.get(guildId);
          if (candidate !== undefined && (room === undefined || candidate < room)) room = candidate;
        }
      }
      if (room === undefined && this.#userRelevant(user)) room = CORRIDOR;
      if (room === undefined) continue;
      const voiceName = voice && this.relevant.has(voice.guildId) ? this.#channelName(voice.guildId, voice.channelId) : null;
      const chatName = chatting && now - chatting.at < CHAT_BUBBLE_MS && this.relevant.has(chatting.guildId)
        ? this.#channelName(chatting.guildId, chatting.channelId)
        : null;
      const typing = this.typing.get(userId);
      const reaction = this.reactions.get(userId);
      // `sharesActivity` is the member's own switch; the rest of the profile is how they look.
      const { sharesActivity = false, ...look } = profileOf(userId);
      seated[room].push({
        id: publicId(userId),
        name: user.name,
        presence: user.status,
        room,
        voice: voiceName,
        voiceState: voiceName ? voice.state : null,
        chat: chatName,
        typing: typing && !chatName && this.relevant.has(typing.guildId) ? this.#channelName(typing.guildId, typing.channelId) : null,
        reaction: reaction ?? null,
        emote: this.emotes.get(userId) ?? null,
        activity: sharesActivity && user.status !== "offline" ? user.activity ?? null : null,
        level: this.#levelOf(userId, user),
        ...look,
        rank: voiceName ? 0 : chatName ? 1 : STATUS_RANK[user.status] ?? 5,
      });
    }

    const members = [];
    seated.forEach((list, index) => {
      list.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
      // The corridor has no room entry to count into.
      if (rooms[index]) {
        rooms[index].total = list.length;
        rooms[index].overflow = Math.max(0, list.length - ROOM_CAP);
        rooms[index].live = list.some(({ rank }) => rank < 2);
      }
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

  /** Put an entry in one of the short-lived maps and take it out again when its time is up. */
  #briefly(map, userId, entry, ms) {
    map.set(userId, entry);
    this.onChange();
    setTimeout(() => {
      // A newer entry (they kept typing, reacted again) has its own timer.
      if (map.get(userId) !== entry) return;
      map.delete(userId);
      this.onChange();
    }, ms).unref();
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
