/**
 * Which Discord server or channel each of the nine rooms shows. Stored as one JSON file next to the server.
 *
 * Until an admin saves once, the rooms are filled automatically: one server per room.
 */
import fs from "node:fs";
import path from "node:path";
import { SLOT_COUNT } from "./world.mjs";

export const LABEL_MAX = 24;
/** The café. Used for the AFK room in the automatic layout. */
const AUTO_IDLE_SLOT = 6;

const isSnowflake = (input) => typeof input === "string" && /^\d{5,25}$/.test(input);

/** Throws on anything unexpected, so a bad request or a hand-edited file is rejected whole. */
export function checkedSlots(input) {
  if (!Array.isArray(input) || input.length !== SLOT_COUNT) throw new Error("Invalid slots");
  return input.map((raw) => {
    if (!raw || typeof raw !== "object") throw new Error("Invalid slot");
    let label;
    if (raw.label !== undefined && raw.label !== "") {
      if (typeof raw.label !== "string") throw new Error("Invalid slot label");
      label = raw.label.replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, " ").trim();
      if (label.length > LABEL_MAX) throw new Error("Invalid slot label");
    }
    const named = label ? { label } : {};
    switch (raw.kind) {
      case "none":
        return { kind: "none" };
      case "idle":
        return { kind: "idle", ...named };
      case "guild":
        if (!isSnowflake(raw.guildId)) throw new Error("Invalid slot guild");
        return { kind: "guild", guildId: raw.guildId, ...named };
      case "channel":
        if (!isSnowflake(raw.guildId) || !isSnowflake(raw.channelId)) throw new Error("Invalid slot channel");
        return { kind: "channel", guildId: raw.guildId, channelId: raw.channelId, ...named };
      default:
        throw new Error("Invalid slot kind");
    }
  });
}

function autoSlots(world) {
  const slots = Array.from({ length: SLOT_COUNT }, () => ({ kind: "none" }));
  const open = slots.map((_, index) => index).filter((index) => index !== AUTO_IDLE_SLOT);
  world.catalog().slice(0, open.length).forEach((guild, order) => {
    slots[open[order]] = { kind: "guild", guildId: guild.id };
  });
  slots[AUTO_IDLE_SLOT] = { kind: "idle" };
  return slots;
}

export class ConfigStore {
  constructor(file) {
    this.file = file;
    this.saved = null;
    try {
      this.saved = checkedSlots(JSON.parse(fs.readFileSync(file, "utf8")).slots);
    } catch (error) {
      if (error.code !== "ENOENT") console.warn(`[config] ${file} tidak terbaca, memakai susunan otomatis: ${error.message}`);
    }
  }

  get auto() {
    return this.saved === null;
  }

  slots(world) {
    return this.saved ?? autoSlots(world);
  }

  save(slots) {
    this.saved = slots;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    // Write beside the target and rename, so a crash mid-write cannot leave half a file.
    const temp = `${this.file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify({ slots }, null, 2));
    fs.renameSync(temp, this.file);
  }

  reset() {
    this.saved = null;
    fs.rmSync(this.file, { force: true });
  }
}
