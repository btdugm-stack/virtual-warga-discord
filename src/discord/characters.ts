/**
 * The ready-made sprites in `public/characters`, tinted. Characters are normally assembled by the server
 * from the character kit; these are only drawn when the server is older than the page and names no character.
 */
export const SPRITE_COUNT = 6;
/** Subtle hue variations make the six sprites look like different people. Larger shifts distort skin tones. */
export const AGENT_HUES = [0, -34, 18, -16, 34, -50] as const;
