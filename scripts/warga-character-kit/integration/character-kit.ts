/**
 * Character kit: layered 112x96 sheets (7 frames x 3 directions, 16x32 each) served from /characters/kit.
 * Every sheet uses the same layout as public/characters/char_N.png, so the layers can be stacked as
 * CSS backgrounds on .world-agent-sprite and the existing walk/type animations keep working.
 * Generated from kit/manifest.json. Do not edit the lists by hand.
 */
export const KIT_BASE = "/characters/kit";

export const BODIES = ["porcelain", "fair", "tan", "bronze", "brown", "deep"] as const;
export const EYES = ["dot", "classic", "brown", "big_blue", "lash_green", "happy", "sleepy", "angry", "wink", "gold"] as const;
export const HAIRS = ["buzz", "short", "side_part", "slick_back", "spiky", "mohawk", "afro", "curly", "bowl", "curtain", "bob", "long_fringe", "long_parted", "ponytail", "twin_tails", "top_bun", "odango", "braids", "wavy_long", "pompadour", "shaggy", "hime", "side_swept", "pixie", "flat_top"] as const;
export const HAIR_COLORS = ["black", "dark_brown", "brown", "auburn", "ginger", "blonde", "platinum", "silver", "pink", "purple", "blue", "green"] as const;
export const TOPS = ["tee_white", "tee_red", "tee_graphic", "tee_striped", "tank_top", "long_sleeve", "raglan", "polo", "button_shirt", "flannel", "batik_shirt", "hoodie", "zip_hoodie", "turtleneck", "sweater_vest", "suit", "denim_jacket", "leather_jacket", "varsity_jacket", "jersey", "dress", "kimono", "tunic", "plate_armor", "mage_robe"] as const;
export const BOTTOMS = ["jeans_blue", "jeans_black", "chinos", "slacks", "cargo_pants", "denim_shorts", "sport_shorts", "bermuda", "pleated_skirt", "mini_skirt", "long_skirt", "leggings", "sweatpants", "ripped_jeans", "sarong"] as const;
export const SHOES = ["sneakers_white", "sneakers_red", "high_tops", "boots_brown", "tall_boots", "loafers", "sandals", "rain_boots"] as const;
export const HATS = ["baseball_cap", "beanie", "top_hat", "cowboy", "caping", "crown", "wizard", "knight_helmet", "beret", "peci", "blangkon", "bandana"] as const;
export const ACCESSORIES = ["glasses", "round_glasses", "sunglasses", "eyepatch", "face_mask", "scarf", "necklace", "earrings", "headphones", "bow_tie", "necktie", "cape", "backpack", "angel_wings", "flower_pin"] as const;

/** Hair styles that also have a layer drawn behind the body. */
const HAIR_WITH_BACK: ReadonlySet<string> = new Set(["long_fringe", "long_parted", "ponytail", "twin_tails", "wavy_long", "hime"]);
/** Hats that need the hair's "__hat" variant, so hair does not poke through the hat. */
const HATS_OVER_HAIR: ReadonlySet<string> = new Set(["baseball_cap", "beanie", "top_hat", "cowboy", "caping", "wizard", "knight_helmet", "beret", "peci", "blangkon"]);
/** Accessories drawn under the hair ("mid"); the rest go on top of everything. */
const ACC_MID: ReadonlySet<string> = new Set(["face_mask", "scarf", "necklace", "bow_tie", "necktie", "cape", "backpack", "angel_wings"]);
const ACC_WITH_BACK: ReadonlySet<string> = new Set(["cape", "angel_wings"]);

export type CharacterSpec = {
  readonly body: string;
  readonly eyes: string;
  readonly hair: string | null;
  readonly hairColor: string;
  readonly top: string | null;
  readonly bottom: string | null;
  readonly shoes: string | null;
  readonly hat: string | null;
  readonly accessories: readonly string[];
};

/** Sheet URLs for a character, bottom layer first. */
export function characterLayers(spec: CharacterSpec, base: string = KIT_BASE): string[] {
  const out: string[] = [];
  for (const id of spec.accessories) if (ACC_WITH_BACK.has(id)) out.push(`${base}/accessories/${id}_back.png`);
  const underHat = spec.hat !== null && HATS_OVER_HAIR.has(spec.hat) ? "__hat" : "";
  const hair = spec.hair === null ? null : `${base}/hair/${spec.hairColor}/${spec.hair}${underHat}`;
  if (hair !== null && spec.hair !== null && HAIR_WITH_BACK.has(spec.hair)) out.push(`${hair}_back.png`);
  out.push(`${base}/body/${spec.body}.png`, `${base}/eyes/${spec.eyes}.png`);
  if (spec.shoes !== null) out.push(`${base}/shoes/${spec.shoes}.png`);
  if (spec.bottom !== null) out.push(`${base}/bottom/${spec.bottom}.png`);
  if (spec.top !== null) out.push(`${base}/top/${spec.top}.png`);
  for (const id of spec.accessories) if (ACC_MID.has(id)) out.push(`${base}/accessories/${id}.png`);
  if (hair !== null) out.push(`${hair}.png`);
  if (spec.hat !== null) out.push(`${base}/hat/${spec.hat}.png`);
  for (const id of spec.accessories) if (!ACC_MID.has(id)) out.push(`${base}/accessories/${id}.png`);
  return out;
}

/** A CSS background-image value: the first image in a CSS list is the top-most one, so the order is reversed. */
export function characterBackground(spec: CharacterSpec, base: string = KIT_BASE): string {
  return characterLayers(spec, base).reverse().map((url) => `url("${url}")`).join(", ");
}

/** mulberry32: a small seeded generator, so the same seed always gives the same character. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable look derived from a number (for example the hash of a member id). */
export function characterFor(seed: number): CharacterSpec {
  const next = seeded(seed);
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(next() * list.length) % list.length] as T;
  const accessories: string[] = [];
  const count = [0, 0, 1, 1, 2][Math.floor(next() * 5) % 5] as number;
  while (accessories.length < count) {
    const id = pick(ACCESSORIES);
    if (!accessories.includes(id)) accessories.push(id);
  }
  return {
    body: pick(BODIES),
    eyes: pick(EYES),
    hair: pick(HAIRS),
    hairColor: pick(HAIR_COLORS),
    top: pick(TOPS),
    bottom: pick(BOTTOMS),
    shoes: pick(SHOES),
    hat: next() < 0.25 ? pick(HATS) : null,
    accessories,
  };
}
