/**
 * What each member chose with the `/karakter` command: the parts of their character, and whether their Discord
 * profile picture is worn as the face (off unless they turn it on, since the site is public).
 * One JSON file keyed by Discord user id; it never leaves the server.
 * Someone who has chosen nothing gets a character derived from their id, the same on every start.
 */
import fs from "node:fs";
import path from "node:path";
import { checkedSpec, specFor } from "./character-kit.mjs";

/** FNV-1a. Only turns an id into the seed of an automatic character; it is not a secret. */
function hashOf(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export class CharacterStore {
  constructor(file) {
    this.file = file;
    /** Only what differs from automatic is kept. @type {Map<string, {spec?: object, photo?: boolean}>} */
    this.choices = new Map();
    try {
      const saved = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const [userId, raw] of Object.entries(saved)) {
        if (!/^\d{5,25}$/.test(userId) || !raw || typeof raw !== "object") continue;
        const choice = {};
        // A part the kit no longer has makes the whole look automatic again rather than half-drawn.
        const spec = checkedSpec(raw.spec);
        if (spec) choice.spec = spec;
        if (raw.photo === true) choice.photo = true;
        if (Object.keys(choice).length) this.choices.set(userId, choice);
      }
    } catch (error) {
      if (error.code !== "ENOENT") console.warn(`[karakter] ${file} tidak terbaca, semua karakter kembali otomatis: ${error.message}`);
    }
  }

  /** The character this member has without choosing. */
  automatic(userId) {
    return specFor(hashOf(userId));
  }

  /** How the member looks now: their chosen parts or the automatic ones. The photo is worn only if they turned it on. */
  look(userId) {
    const saved = this.choices.get(userId);
    return { spec: saved?.spec ?? this.automatic(userId), photo: saved?.photo ?? false };
  }

  /** Replace the member's choice. A `spec` of null puts the character back to automatic. */
  update(userId, { spec, photo }) {
    const saved = {};
    if (spec) saved.spec = spec;
    if (photo === true) saved.photo = true;
    if (Object.keys(saved).length) this.choices.set(userId, saved);
    else this.choices.delete(userId);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    // Write beside the target and rename, so a crash mid-write cannot leave half a file.
    const temp = `${this.file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(Object.fromEntries(this.choices)));
    fs.renameSync(temp, this.file);
  }
}
