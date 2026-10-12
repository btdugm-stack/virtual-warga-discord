import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CharacterStore } from "../character-store.mjs";

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "warga-characters-"));
  return path.join(dir, "characters.json");
}

test("listed is off unless turned on", () => {
  const store = new CharacterStore(tempFile());
  assert.equal(store.look("123456789").listed, false);
});

test("listed survives a reload, even with the automatic look", () => {
  const file = tempFile();
  const store = new CharacterStore(file);
  // The automatic look is stored as nothing chosen, so only `listed` is kept.
  store.update("123456789", { spec: null, listed: true });
  assert.equal(store.look("123456789").listed, true);

  const reloaded = new CharacterStore(file);
  assert.equal(reloaded.look("123456789").listed, true);
});

test("turning listing off prunes a record with nothing else chosen", () => {
  const file = tempFile();
  const store = new CharacterStore(file);
  store.update("123456789", { spec: null, listed: true });
  store.update("123456789", { spec: null, listed: false });
  assert.equal(store.look("123456789").listed, false);

  const reloaded = new CharacterStore(file);
  assert.equal(reloaded.look("123456789").listed, false);
});
