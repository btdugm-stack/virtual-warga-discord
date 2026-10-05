/**
 * The character kit: layered sprite sheets (skin, eyes, hair, clothes, hat, accessories) that are stacked
 * into one character. Every layer is a full 112×96 sheet in the layout the office already animates, so a
 * stacked character walks and types like the old ready-made ones.
 *
 * Besides the parts there are a few ready-made characters, each one whole sheet (`WHOLES`). Those may be
 * drawn finer than the 112×96 grid, as long as they keep its 7×3 frames: the page draws every character at
 * the same size, so a finer sheet only means more detail.
 *
 * `character-kit/manifest.json` lists what exists and how the layers stack; nothing about the kit's contents
 * is hard-coded here. A look is passed around in two forms: a `spec` naming each part by id (what is saved),
 * and a short `code` (what goes in URLs and Discord button ids). Codes are positions in the manifest, so they
 * are only meaningful for the manifest they were made from; that is why they are never saved.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const KIT_DIR = fileURLToPath(new URL("./character-kit/", import.meta.url));
const manifest = JSON.parse(fs.readFileSync(`${KIT_DIR}manifest.json`, "utf8"));

const SHEET = manifest.format.sheet;
const FRAME = manifest.format.frame;
const idsOf = (category) => manifest.categories[category].map(({ id }) => id);

/** The parts of a look, in the order the code spells them. Each takes one character of the code. */
export const PARTS = [
  { key: "body", ids: idsOf("body") },
  { key: "eyes", ids: idsOf("eyes") },
  { key: "hair", ids: idsOf("hair") },
  { key: "hairColor", ids: idsOf("hairColor") },
  { key: "top", ids: idsOf("top") },
  { key: "bottom", ids: idsOf("bottom") },
  { key: "shoes", ids: idsOf("shoes") },
  // The only part a character can go without.
  { key: "hat", ids: idsOf("hat"), optional: true },
];
export const ACCESSORIES = idsOf("accessories");
/**
 * Ready-made characters: whole sheets in `character-kit/whole/`, worn as they are instead of being assembled.
 * Dropping a sheet there (lower-case name, digits, underscores) adds one; the file name is its id.
 */
export const WHOLES = fs.readdirSync(`${KIT_DIR}whole`)
  .filter((name) => /^[a-z0-9_]{1,40}\.png$/.test(name))
  .map((name) => name.slice(0, -4))
  .sort();
/** A ready-made character's code is this letter and its id. Assembled looks start with the code version instead. */
const WHOLE_PREFIX = "w";
/**
 * What separates a ready-made character's id from its sheet's fingerprint. An id can never contain it, so
 * the id is whatever comes before it. The fingerprint is only there to give replaced art a new address:
 * a code without one still names the character, and gets whatever art is in place now.
 */
const TAG = "-";
/** More than this and they pile up on a 16-pixel-wide figure. */
export const ACCESSORIES_MAX = 3;

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";
/** In a code, the hat position holds this when there is no hat. */
const NONE = "z";
const CODE_VERSION = "1";
/** Fifteen accessories as a bit mask need three base-36 digits. */
const ACCESSORY_DIGITS = 3;
const CODE_PATTERN = new RegExp(`^${CODE_VERSION}[0-9a-z]{${PARTS.length + ACCESSORY_DIGITS}}$`);

if (PARTS.some(({ ids }) => ids.length >= DIGITS.length - 1) || 2 ** ACCESSORIES.length > DIGITS.length ** ACCESSORY_DIGITS) {
  throw new Error("The character kit has grown past what a look code can spell; widen the code before adding more.");
}

/**
 * A ready-made sheet, read once: the file as it will be served, its pixels, how many times finer than the
 * 112×96 grid it is drawn, and a fingerprint of its bytes.
 */
const wholeSheets = new Map();

function wholeSheet(id) {
  let sheet = wholeSheets.get(id);
  if (!sheet) {
    const file = `whole/${id}.png`;
    const png = fs.readFileSync(KIT_DIR + file);
    const image = PNG.sync.read(png);
    const scale = image.width / SHEET.width;
    if (!Number.isInteger(scale) || scale < 1 || image.height !== SHEET.height * scale) {
      throw new Error(`${file} is not a ${SHEET.width}×${SHEET.height} sheet, or a whole multiple of one`);
    }
    sheet = { png, data: image.data, width: image.width, scale, tag: crypto.createHash("sha256").update(png).digest("hex").slice(0, 6) };
    wholeSheets.set(id, sheet);
  }
  return sheet;
}

/** True when a look's sheet is finer than the grid, so the page should draw it smoothly instead of pixelated. */
export function smoothSpec(spec) {
  return Boolean(spec.whole) && wholeSheet(spec.whole).scale > 1;
}

/** A spec with every part checked against the manifest, or null. Accepts what `characters.json` holds. */
export function checkedSpec(input) {
  if (!input || typeof input !== "object") return null;
  const spec = {};
  for (const { key, ids, optional } of PARTS) {
    const value = input[key] ?? null;
    if (value === null ? !optional : !ids.includes(value)) return null;
    spec[key] = value;
  }
  if (!Array.isArray(input.accessories)) return null;
  // Kept in manifest order, so the same set always gives the same code.
  spec.accessories = ACCESSORIES.filter((id) => input.accessories.includes(id));
  if (spec.accessories.length !== input.accessories.length || spec.accessories.length > ACCESSORIES_MAX) return null;
  // A ready-made character worn over the parts. The parts are kept, so going back to "assembled" restores them.
  spec.whole = input.whole ?? null;
  if (spec.whole !== null && !WHOLES.includes(spec.whole)) return null;
  return spec;
}

export function codeOf(spec) {
  if (spec.whole) return WHOLE_PREFIX + spec.whole + TAG + wholeSheet(spec.whole).tag;
  const parts = PARTS.map(({ key, ids }) => (spec[key] === null ? NONE : DIGITS[ids.indexOf(spec[key])]));
  const mask = spec.accessories.reduce((bits, id) => bits | (1 << ACCESSORIES.indexOf(id)), 0);
  return CODE_VERSION + parts.join("") + mask.toString(36).padStart(ACCESSORY_DIGITS, "0");
}

/** The spec a code spells, or null when it is not a code this kit could have produced. */
export function specOf(code) {
  if (typeof code !== "string") return null;
  if (code.startsWith(WHOLE_PREFIX)) {
    const whole = code.slice(WHOLE_PREFIX.length).split(TAG)[0];
    // The code names only the ready-made character; the parts underneath are a fixed placeholder.
    return WHOLES.includes(whole) ? { ...specFor(0), whole } : null;
  }
  if (!CODE_PATTERN.test(code)) return null;
  const spec = {};
  for (const [index, { key, ids, optional }] of PARTS.entries()) {
    const digit = code[index + 1];
    if (digit === NONE) {
      if (!optional) return null;
      spec[key] = null;
    } else {
      const id = ids[DIGITS.indexOf(digit)];
      if (id === undefined) return null;
      spec[key] = id;
    }
  }
  const mask = parseInt(code.slice(PARTS.length + 1), 36);
  if (mask >= 2 ** ACCESSORIES.length) return null;
  spec.accessories = ACCESSORIES.filter((_, index) => mask & (1 << index));
  spec.whole = null;
  return spec.accessories.length > ACCESSORIES_MAX ? null : spec;
}

/**
 * What the site's character builder needs to offer every part and to spell a look's code itself: each option
 * with the digit it takes in the code, in code order. The page never has to know the alphabet behind them.
 */
export function kitDescription() {
  return {
    version: CODE_VERSION,
    none: NONE,
    parts: PARTS.map(({ key, ids, optional }) => ({
      key,
      optional: Boolean(optional),
      options: ids.map((id, index) => ({ id, digit: DIGITS[index] })),
    })),
    accessories: ACCESSORIES.map((id, index) => ({ id, bit: 1 << index })),
    accessoryDigits: ACCESSORY_DIGITS,
    accessoriesMax: ACCESSORIES_MAX,
    wholes: WHOLES.map((id) => ({ id, code: codeOf({ whole: id }), smooth: wholeSheet(id).scale > 1 })),
  };
}

/** mulberry32: a small seeded generator, so the same seed always gives the same character. */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole look from one number. Most characters get no hat and at most one accessory, so they stay readable. */
export function specFor(seed) {
  const next = seeded(seed);
  const pick = (list) => list[Math.floor(next() * list.length)];
  const spec = {};
  for (const { key, ids, optional } of PARTS) spec[key] = optional && next() >= 0.25 ? null : pick(ids);
  const wanted = [0, 0, 1, 1, 2][Math.floor(next() * 5)];
  const accessories = new Set();
  while (accessories.size < wanted) accessories.add(pick(ACCESSORIES));
  spec.accessories = ACCESSORIES.filter((id) => accessories.has(id));
  spec.whole = null;
  return spec;
}

/** The sheets that make up a look, bottom layer first, following the manifest's layer order. */
function layerFiles(spec) {
  const { categories, hairUnderHatSuffix } = manifest;
  const entry = (category, id) => categories[category].find((item) => item.id === id);
  const accessories = spec.accessories.map((id) => entry("accessories", id));
  // Under a hat that sits on the hair, the hair's cut-down variant is used so it does not poke through.
  const underHat = spec.hat !== null && entry("hat", spec.hat).hairUnderHat ? hairUnderHatSuffix : "";
  const hairBase = `hair/${spec.hairColor}/${spec.hair}${underHat}`;
  const single = (category) => (spec[category] === null ? [] : [entry(category, spec[category]).file]);
  const layers = {
    "accessories:back": accessories.filter(({ back }) => back).map(({ file }) => file.replace(/\.png$/, "_back.png")),
    "hair:back": entry("hair", spec.hair).back ? [`${hairBase}_back.png`] : [],
    body: single("body"),
    eyes: single("eyes"),
    shoes: single("shoes"),
    bottom: single("bottom"),
    top: single("top"),
    "accessories:mid": accessories.filter(({ slot }) => slot === "mid").map(({ file }) => file),
    hair: [`${hairBase}.png`],
    hat: single("hat"),
    "accessories:front": accessories.filter(({ slot }) => slot !== "mid").map(({ file }) => file),
  };
  return manifest.layerOrder.flatMap((name) => {
    if (!layers[name]) throw new Error(`Unknown layer in the kit manifest: ${name}`);
    return layers[name];
  });
}

/** Decoded layers by file. The kit is a few megabytes in all, so everything ever used stays in memory. */
const layerPixels = new Map();

function pixelsOf(file) {
  let pixels = layerPixels.get(file);
  if (!pixels) {
    const image = PNG.sync.read(fs.readFileSync(KIT_DIR + file));
    if (image.width !== SHEET.width || image.height !== SHEET.height) throw new Error(`${file} is not a ${SHEET.width}×${SHEET.height} sheet`);
    pixels = image.data;
    layerPixels.set(file, pixels);
  }
  return pixels;
}

/** The layers of a look painted over each other: RGBA, one full sheet. */
function stacked(spec) {
  const sheet = Buffer.alloc(SHEET.width * SHEET.height * 4);
  for (const file of layerFiles(spec)) {
    const layer = pixelsOf(file);
    for (let at = 0; at < sheet.length; at += 4) {
      const alpha = layer[at + 3];
      if (alpha === 0) continue;
      if (alpha === 255 || sheet[at + 3] === 0) {
        layer.copy(sheet, at, at, at + 4);
        continue;
      }
      // A half-transparent pixel (a lens, a shadow) over something already drawn.
      const under = sheet[at + 3];
      const out = alpha + (under * (255 - alpha)) / 255;
      for (let channel = 0; channel < 3; channel += 1) {
        sheet[at + channel] = Math.round((layer[at + channel] * alpha + (sheet[at + channel] * under * (255 - alpha)) / 255) / out);
      }
      sheet[at + 3] = Math.round(out);
    }
  }
  return sheet;
}

function encoded(width, height, data) {
  const image = new PNG({ width, height });
  data.copy(image.data);
  return PNG.sync.write(image);
}

const SHEET_CACHE_MAX = 500;
/** Finished sheets by code, oldest first. */
const sheets = new Map();

/** The pixels a look is drawn from, with the sheet's width and how fine it is. */
function sheetFor(spec) {
  if (!spec.whole) return { data: stacked(spec), width: SHEET.width, scale: 1 };
  const { data, width, scale } = wholeSheet(spec.whole);
  return { data, width, scale };
}

/**
 * The character's whole sprite sheet as a PNG file, in the layout `public/characters/char_N.png` has.
 * A code always means the same picture, so what this returns can be cached for as long as the caller likes.
 */
export function sheetPng(code) {
  let png = sheets.get(code);
  if (!png) {
    const spec = specOf(code);
    if (!spec) return null;
    // A ready-made sheet is already a PNG of the right shape, so the file itself is what gets sent.
    png = spec.whole ? wholeSheet(spec.whole).png : encoded(SHEET.width, SHEET.height, stacked(spec));
    sheets.set(code, png);
    if (sheets.size > SHEET_CACHE_MAX) sheets.delete(sheets.keys().next().value);
  }
  return png;
}

const PREVIEW_SCALE = 6;
const PREVIEW_PADDING = 12;
/** --color-cream: on a transparent picture, Discord's dark theme would swallow dark hair and clothes. */
const PREVIEW_BACKGROUND = [255, 253, 245, 255];

/**
 * A picture for the `/karakter` picker: the character standing, seen from the front, the back, and the side,
 * enlarged so the pixels can be told apart.
 */
export function previewPng(spec) {
  const { data: sheet, width: sheetWidth, scale } = sheetFor(spec);
  const frameWidth = FRAME.width * scale;
  const frameHeight = FRAME.height * scale;
  // A finer sheet needs less enlarging, so every character comes out about the same size in the picker.
  const zoom = Math.max(1, Math.round(PREVIEW_SCALE / scale));
  const rows = manifest.format.rows.length;
  const width = frameWidth * rows * zoom + PREVIEW_PADDING * 2;
  const height = frameHeight * zoom + PREVIEW_PADDING * 2;
  const picture = Buffer.alloc(width * height * 4);
  for (let at = 0; at < picture.length; at += 4) picture.set(PREVIEW_BACKGROUND, at);
  for (let view = 0; view < rows; view += 1) {
    for (let y = 0; y < frameHeight; y += 1) {
      for (let x = 0; x < frameWidth; x += 1) {
        // The first frame of each row is the standing pose for that direction.
        const from = ((view * frameHeight + y) * sheetWidth + x) * 4;
        if (sheet[from + 3] === 0) continue;
        for (let dy = 0; dy < zoom; dy += 1) {
          const rowStart = (PREVIEW_PADDING + y * zoom + dy) * width + PREVIEW_PADDING + (view * frameWidth + x) * zoom;
          for (let dx = 0; dx < zoom; dx += 1) sheet.copy(picture, (rowStart + dx) * 4, from, from + 3);
        }
      }
    }
  }
  return encoded(width, height, picture);
}
