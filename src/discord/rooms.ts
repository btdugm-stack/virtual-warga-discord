import { CORRIDOR_ROOM, ROOM_ZONES } from "../game/office-world";
import { localized, type Locale } from "../i18n";
import { COPY, DOING_LABELS, VOICE_STATE_LABELS, fill } from "./copy";
import type { Member, RoomState } from "./types";

/** What a room is called: its custom label or Discord name, else what the floor plan calls that room. */
export function roomTitle(room: RoomState | undefined, index: number, locale: Locale): string {
  if (index === CORRIDOR_ROOM) return localized(COPY.roomCorridor, locale);
  if (room?.title) return room.title;
  if (room?.kind === "idle") return localized(COPY.roomIdle, locale);
  return localized(ROOM_ZONES[index].name, locale);
}

/** The line under a room's name: why it is empty, or how many people are in it. */
export function roomNote(room: RoomState | undefined, locale: Locale): string {
  if (!room || room.kind === "none") return localized(COPY.roomEmpty, locale);
  if (room.missing) return localized(COPY.roomMissing, locale);
  if (room.blocked) return localized(COPY.roomBlocked, locale);
  return fill(COPY.roomCount, locale, { count: room.total });
}

/** "Main Valorant", when the member lets their activity be shown and has one. */
export function doingText(member: Member, locale: Locale): string | null {
  return member.activity ? fill(DOING_LABELS[member.activity.kind], locale, { name: member.activity.name }) : null;
}

/** The voice channel, with how they are in it when that is worth saying: "Mabar · bisu". */
export function voiceText(member: Member, locale: Locale): string | null {
  if (!member.voice) return null;
  return member.voiceState ? `${member.voice} · ${localized(VOICE_STATE_LABELS[member.voiceState], locale)}` : member.voice;
}

/** One line for what the member is doing, the most momentary thing first. */
export function activityText(member: Member, locale: Locale): string {
  if (member.chat) return fill(COPY.activityChat, locale, { where: member.chat });
  if (member.typing) return fill(COPY.activityTyping, locale, { where: member.typing });
  const doing = doingText(member, locale);
  const voice = voiceText(member, locale);
  if (voice) return fill(COPY.activityVoice, locale, { where: voice }) + (doing ? ` · ${doing}` : "");
  if (doing) return doing;
  if (member.presence === "offline") return localized(COPY.activityOffline, locale);
  return localized(member.presence === "idle" ? COPY.activityIdle : COPY.activityNone, locale);
}
