/**
 * The shared furniture layout: what every visitor's office looks like. One JSON file, written only by an admin.
 *
 * The checks here are about shape and size, enough to keep junk out of the file. Whether furniture overlaps
 * or blocks a walkway is decided by the browser (`checkedOfficeLayout` in `src/game/office-world.ts`), which
 * falls back to the default layout when a stored one does not pass.
 */
import fs from "node:fs";
import path from "node:path";

const THEMES = ["warm", "mint", "violet"];
const FURNITURE_MAX = 240;
const OFFICE_COLS = 72;
const OFFICE_ROWS = 30;

const isInt = (input, min, max) => Number.isInteger(input) && input >= min && input <= max;
const hasKeys = (input, keys) => (
  !!input && typeof input === "object" && !Array.isArray(input)
  && Object.keys(input).length === keys.length && keys.every((key) => Object.hasOwn(input, key))
);

export function checkedLayout(input) {
  if (!hasKeys(input, ["version", "officeName", "theme", "headcount", "furniture"])) throw new Error("Invalid layout");
  if (
    input.version !== 4
    || typeof input.officeName !== "string" || !input.officeName.trim() || input.officeName.length > 32
    || !THEMES.includes(input.theme)
    || !isInt(input.headcount, 1, 100)
    || !Array.isArray(input.furniture) || input.furniture.length > FURNITURE_MAX
  ) throw new Error("Invalid layout");
  const furniture = input.furniture.map((item) => {
    if (
      !hasKeys(item, ["uid", "type", "col", "row", "rotation", "hue"])
      || typeof item.uid !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(item.uid)
      || typeof item.type !== "string" || !/^[A-Z0-9_]{1,40}$/.test(item.type)
      || !isInt(item.col, 0, OFFICE_COLS - 1) || !isInt(item.row, 0, OFFICE_ROWS - 1)
      || ![0, 90, 180, 270].includes(item.rotation)
      || !isInt(item.hue, 0, 359)
    ) throw new Error("Invalid furniture");
    return { uid: item.uid, type: item.type, col: item.col, row: item.row, rotation: item.rotation, hue: item.hue };
  });
  return { version: 4, officeName: input.officeName, theme: input.theme, headcount: input.headcount, furniture };
}

export class LayoutStore {
  constructor(file) {
    this.file = file;
    this.layout = null;
    /** Bumped on every save, so open browsers know to fetch the new layout. */
    this.rev = 0;
    try {
      this.layout = checkedLayout(JSON.parse(fs.readFileSync(file, "utf8")));
    } catch (error) {
      if (error.code !== "ENOENT") console.warn(`[layout] ${file} tidak terbaca, memakai tata letak bawaan: ${error.message}`);
    }
  }

  save(layout) {
    this.layout = layout;
    this.rev += 1;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    // Write beside the target and rename, so a crash mid-write cannot leave half a file.
    const temp = `${this.file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(layout));
    fs.renameSync(temp, this.file);
  }
}
