/**
 * The shapes the server sends. `server/world.mjs` builds the public snapshot and `server/config-store.mjs`
 * validates the room bindings; keep these in step with them.
 */

export const SLOT_COUNT = 9;
export const SLOT_LABEL_MAX = 24;

export type Presence = "online" | "idle" | "dnd" | "offline";

export type RoomKind = "none" | "guild" | "channel" | "idle";

export type RoomState = {
  readonly kind: RoomKind;
  /** The custom label, else the server or channel name. Empty for an unbound or AFK room without a label. */
  readonly title: string;
  /** The server a channel room belongs to. */
  readonly subtitle: string;
  /** The bound server or channel is gone, or the bot can no longer see it. */
  readonly missing: boolean;
  /** The bot is not allowed to see into the bound channel, so nothing that happens there reaches the office. */
  readonly blocked?: boolean;
  readonly total: number;
  /** People in the room beyond what the server sends. */
  readonly overflow: number;
  /** Someone here is in voice or chatting right now. */
  readonly live: boolean;
};

export type VoiceState = "live" | "video" | "deaf" | "mute";
export type ActivityKind = "play" | "stream" | "listen" | "watch" | "compete";
/** The moves `/emote` offers. `server/emote-command.mjs` lists the same kinds; `app.css` draws them. */
export type EmoteKind = "lambai" | "joget" | "lompat" | "putar" | "baca";

export type Member = {
  /** Not a Discord id: a per-run hash, stable only while the server stays up. */
  readonly id: string;
  readonly name: string;
  readonly presence: Presence;
  readonly room: number;
  /** Voice channel name, when in one. */
  readonly voice: string | null;
  /** Text channel name, for a minute after their last message. The message itself is never sent. */
  readonly chat: string | null;
  /**
   * The code of the member's character: assembled with `/karakter`, else derived from the member. Its sprite
   * sheet is at `/api/character/<look>.png`. Absent when the server is older than the page (the two are
   * restarted separately); the page then falls back to the six ready-made sprites.
   */
  readonly look?: string;
  /**
   * Set when the member wears their Discord profile picture as a face. Not an address: a tag that changes
   * with the picture. The image is at `/api/avatar/<id>`.
   */
  readonly avatar?: string | null;
  /*
   * Everything below is absent when the server is older than the page.
   */
  /** The one thing worth showing about how they are in the call. */
  readonly voiceState?: VoiceState | null;
  /** Text channel name while Discord reports them typing there. */
  readonly typing?: string | null;
  /** The emoji of a reaction they just added: a character, or the address of a server emoji's picture. `id` changes with each one. */
  readonly reaction?: { readonly id: number; readonly text?: string; readonly image?: string } | null;
  /** A move their character is doing right now. `id` changes with each `/emote`. */
  readonly emote?: { readonly id: number; readonly kind: EmoteKind } | null;
  /** Their character's sheet is drawn finer than the office's grid, so it is scaled down smoothly. */
  readonly smooth?: boolean;
  /** Their level on the server's MEE6 leaderboard, when it could be read. */
  readonly level?: number | null;
  /** What their Discord status says they are doing, if they chose to show it. Only the name of the game or app. */
  readonly activity?: { readonly kind: ActivityKind; readonly name: string } | null;
};

export type FeedKind = "online" | "idle" | "dnd" | "offline" | "voice_join" | "voice_move" | "voice_leave" | "chat";

export type FeedEntry = {
  readonly id: number;
  readonly at: string;
  readonly kind: FeedKind;
  readonly name: string;
  /** Channel name for voice and chat entries. */
  readonly where: string;
};

export type Snapshot = {
  readonly status: "connecting" | "ready" | "error";
  readonly errorCode: "" | "token" | "intents" | "unknown";
  /** The server has no bot token and is showing invented data. */
  readonly demo: boolean;
  readonly botName: string;
  readonly rooms: readonly RoomState[];
  readonly members: readonly Member[];
  readonly feed: readonly FeedEntry[];
  /** Changes whenever an admin saves the furniture layout. */
  readonly layoutRev: number;
};

/** The parts of a character that take exactly one option. `hat` may also be none. */
export type PartKey = "body" | "eyes" | "hair" | "hairColor" | "top" | "bottom" | "shoes" | "hat";

/** A character named part by part, with the kit's ids. */
export type CharacterSpec = {
  readonly body: string;
  readonly eyes: string;
  readonly hair: string;
  readonly hairColor: string;
  readonly top: string;
  readonly bottom: string;
  readonly shoes: string;
  readonly hat: string | null;
  readonly accessories: readonly string[];
  /** A ready-made character worn instead of the assembled one. The parts above are kept underneath. */
  readonly whole?: string | null;
};

/** What `/api/kit` says the builder can offer, with what each option contributes to a look's code. */
export type Kit = {
  readonly version: string;
  /** The digit an optional part takes in the code when it is left out. */
  readonly none: string;
  readonly parts: readonly { readonly key: PartKey; readonly optional: boolean; readonly options: readonly { readonly id: string; readonly digit: string }[] }[];
  readonly accessories: readonly { readonly id: string; readonly bit: number }[];
  readonly accessoryDigits: number;
  readonly accessoriesMax: number;
  /** Ready-made characters, each with its whole code. */
  readonly wholes: readonly { readonly id: string; readonly code: string; readonly smooth: boolean }[];
  /** "Masuk dengan Discord" is set up on this server. */
  readonly oauth: boolean;
};

/** The signed-in member, from `/api/me`. */
export type Me = {
  readonly name: string;
  readonly spec: CharacterSpec;
  readonly photo: boolean;
  readonly activity: boolean;
  /** The character they have without choosing. */
  readonly automatic: CharacterSpec;
};

export type Slot =
  | { readonly kind: "none" }
  | { readonly kind: "idle"; readonly label?: string }
  | { readonly kind: "guild"; readonly guildId: string; readonly label?: string }
  | { readonly kind: "channel"; readonly guildId: string; readonly channelId: string; readonly label?: string };

export type CatalogChannel = { readonly id: string; readonly name: string; readonly type: "text" | "voice"; readonly viewable?: boolean };
export type CatalogGuild = { readonly id: string; readonly name: string; readonly channels: readonly CatalogChannel[] };

export type AdminConfig = {
  /** No bindings saved yet: the server fills rooms on its own, one Discord server per room. */
  readonly auto: boolean;
  readonly slots: readonly Slot[];
  readonly guilds: readonly CatalogGuild[];
};
