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
  readonly total: number;
  /** People in the room beyond what the server sends. */
  readonly overflow: number;
  /** Someone here is in voice or chatting right now. */
  readonly live: boolean;
};

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

export type Slot =
  | { readonly kind: "none" }
  | { readonly kind: "idle"; readonly label?: string }
  | { readonly kind: "guild"; readonly guildId: string; readonly label?: string }
  | { readonly kind: "channel"; readonly guildId: string; readonly channelId: string; readonly label?: string };

export type CatalogChannel = { readonly id: string; readonly name: string; readonly type: "text" | "voice" };
export type CatalogGuild = { readonly id: string; readonly name: string; readonly channels: readonly CatalogChannel[] };

export type AdminConfig = {
  /** No bindings saved yet: the server fills rooms on its own, one Discord server per room. */
  readonly auto: boolean;
  readonly slots: readonly Slot[];
  readonly guilds: readonly CatalogGuild[];
};
