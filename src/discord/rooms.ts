import { ROOM_ZONES } from "../game/office-world";
import { localized, type Locale } from "../i18n";
import { COPY, fill } from "./copy";
import type { Member, RoomState } from "./types";

/** What a room is called: its custom label or Discord name, else what the floor plan calls that room. */
export function roomTitle(room: RoomState | undefined, index: number, locale: Locale): string {
  if (room?.title) return room.title;
  if (room?.kind === "idle") return localized(COPY.roomIdle, locale);
  return localized(ROOM_ZONES[index].name, locale);
}

/** The line under a room's name: why it is empty, or how many people are in it. */
export function roomNote(room: RoomState | undefined, locale: Locale): string {
  if (!room || room.kind === "none") return localized(COPY.roomEmpty, locale);
  if (room.missing) return localized(COPY.roomMissing, locale);
  return fill(COPY.roomCount, locale, { count: room.total });
}

export function activityText(member: Member, locale: Locale): string {
  if (member.chat) return fill(COPY.activityChat, locale, { where: member.chat });
  if (member.voice) return fill(COPY.activityVoice, locale, { where: member.voice });
  if (member.presence === "offline") return localized(COPY.activityOffline, locale);
  return localized(member.presence === "idle" ? COPY.activityIdle : COPY.activityNone, locale);
}
