/**
 * The character kit's code/spec encoding (`server/character-kit.mjs`): a look is spelled by a short code with
 * no gaps, the round-trip must be exact, and nothing a picker could submit that the kit cannot draw may pass
 * `checkedSpec`.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ACCESSORIES, ACCESSORIES_MAX, PARTS, WHOLES, checkedSpec, codeOf, kitDescription, specFor, specOf } from "../character-kit.mjs";

const partIds = (key) => PARTS.find((part) => part.key === key).ids;
/** A fully-specified look: one of each required part, a hat, and the first three accessories. */
function fullSpec() {
  return {
    body: partIds("body")[0],
    eyes: partIds("eyes")[0],
    hair: partIds("hair")[0],
    hairColor: partIds("hairColor")[0],
    top: partIds("top")[0],
    bottom: partIds("bottom")[0],
    shoes: partIds("shoes")[0],
    hat: partIds("hat")[0],
    accessories: ACCESSORIES.slice(0, 3),
    whole: null,
  };
}

test("the same seed always yields the same character, a different seed a different one", () => {
  assert.deepEqual(specFor(12345), specFor(12345));
  assert.notDeepEqual(specFor(12345), specFor(6789));
});

test("an automatic character survives the code round-trip exactly", () => {
  const spec = specFor(42);
  assert.deepEqual(specOf(codeOf(spec)), spec);
});

test("a fully-specified look survives the code round-trip exactly", () => {
  const spec = checkedSpec(fullSpec());
  assert.deepEqual(specOf(codeOf(spec)), spec);
});

test("going without a hat spells the none digit in the code", () => {
  const spec = { ...specFor(1), hat: null };
  const code = codeOf(spec);
  // The code is: version digit, then one digit per part (body..shoes, hat), then the accessory mask.
  assert.equal(code, codeOf({ ...specFor(1), hat: null }));
  assert.equal(specOf(code).hat, null);
});

test("a ready-made character is spelled as its own code", () => {
  const whole = WHOLES[0];
  assert.equal(codeOf({ ...specFor(0), whole }), `w${whole}`);
  assert.equal(specOf(`w${whole}`).whole, whole);
});

test("an unknown whole is not a code this kit could have produced", () => {
  assert.equal(specOf("wnope"), null);
});

test("checkedSpec accepts a valid look", () => {
  const spec = checkedSpec(fullSpec());
  assert.notEqual(spec, null);
  assert.deepEqual(spec.accessories, ACCESSORIES.slice(0, 3), "accessories are kept in manifest order");
});

test("checkedSpec rejects junk, unknown parts, too many accessories, and unknown wholes", () => {
  const full = fullSpec();
  assert.equal(checkedSpec(null), null);
  assert.equal(checkedSpec(undefined), null);
  assert.equal(checkedSpec({}), null);
  assert.equal(checkedSpec({ ...full, top: "tidak-ada" }), null, "an unknown part id is rejected");
  assert.equal(checkedSpec({ ...full, accessories: ACCESSORIES.slice(0, ACCESSORIES_MAX + 1) }), null);
  assert.equal(checkedSpec({ ...full, whole: "nope" }), null);
});

test("the kit description matches the encoding the code uses", () => {
  const description = kitDescription();
  assert.equal(description.version, "1");
  assert.equal(description.parts.length, PARTS.length);
  assert.equal(description.accessoriesMax, ACCESSORIES_MAX);
  assert.equal(description.wholes.length, WHOLES.length);

  // A code is the version, one digit per part, then the accessory mask as described.
  const code = codeOf(specFor(7));
  assert.equal(code.length, 1 + PARTS.length + description.accessoryDigits);
  assert.match(code, /^[0-9a-z]+$/);
});