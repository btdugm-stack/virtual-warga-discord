/**
 * Room-binding validation and storage (`server/config-store.mjs`): `checkedSlots` rejects anything malformed
 * whole, `ConfigStore` fills rooms automatically until an admin saves, and a save is atomically written so a
 * restart reloads it.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { ConfigStore, checkedSlots, LABEL_MAX } from "../config-store.mjs";
import { SLOT_COUNT, World } from "../world.mjs";

const GUILD = "100000000000000001";
const empty = () => Array.from({ length: SLOT_COUNT }, () => ({ kind: "none" }));
const none = empty();

test("nine empty slots are valid", () => {
  assert.deepEqual(checkedSlots(none), none);
});

test("the slot list must be exactly SLOT_COUNT long", () => {
  assert.throws(() => checkedSlots(none.slice(0, -1)), /Invalid slots/);
  assert.throws(() => checkedSlots([...none, { kind: "none" }]), /Invalid slots/);
  assert.throws(() => checkedSlots("slots"), /Invalid slots/);
});

test("an unknown slot kind is rejected", () => {
  assert.throws(() => checkedSlots(empty().map((slot) => (slot.kind === "none" ? { kind: "bogus" } : slot))), /Invalid slot kind/);
});

test("a guild slot must carry a snowflake id", () => {
  assert.throws(() => checkedSlots([{ ...empty()[0], kind: "guild", guildId: "123" }, ...empty().slice(1)]), /Invalid slot guild/);
  assert.throws(() => checkedSlots(empty().map((slot) => ({ ...slot, kind: "guild" }))), /Invalid slot guild/);
});

test("a channel slot must carry server and channel snowflakes", () => {
  const missingChannelId = empty();
  missingChannelId[0] = { kind: "channel", guildId: GUILD };
  assert.throws(() => checkedSlots(missingChannelId), /Invalid slot channel/);
});

test("labels longer than LABEL_MAX are rejected", () => {
  const long = empty();
  long[0] = { kind: "idle", label: "x".repeat(LABEL_MAX + 1) };
  assert.throws(() => checkedSlots(long), /Invalid slot label/);
});

test("control characters in a label are collapsed to a single space", () => {
  const tidy = empty();
  tidy[0] = { kind: "idle", label: "Kantor\u0007utama\n\u0031" };
  assert.equal(checkedSlots(tidy)[0].label, "Kantor utama 1");
});

test("an empty or missing label is left off the slot", () => {
  const bare = empty();
  bare[0] = { kind: "idle" };
  assert.equal(Object.hasOwn(checkedSlots(bare)[0], "label"), false);
});

test("labels must be strings", () => {
  const bad = empty();
  bad[0] = { kind: "idle", label: 7 };
  assert.throws(() => checkedSlots(bad), /Invalid slot label/);
});

test("with nothing saved the rooms are filled automatically, one server per room and an AFK slot", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "warga-cfg-"));
  const world = new World();
  world.setGuild(GUILD, "Warung Kopi");
  world.setGuild("100000000000000002", "Pos Ronda");

  try {
    const store = new ConfigStore(path.join(dir, "rooms.json"));
    assert.equal(store.auto, true);
    const slots = store.slots(world);
    assert.equal(slots.length, SLOT_COUNT);
    assert.equal(slots[6].kind, "idle", "the café is the AFK room in the automatic layout");
    assert.deepEqual(
      slots.map((slot) => slot.kind).sort(),
      ["guild", "guild", "idle", "none", "none", "none", "none", "none", "none"],
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a saved layout replaces the automatic one and survives a restart", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "warga-cfg-"));
  const file = path.join(dir, "rooms.json");
  const world = new World();
  world.setGuild(GUILD, "Warung Kopi");

  try {
    const store = new ConfigStore(file);
    const saved = empty();
    saved[0] = { kind: "guild", guildId: GUILD, label: "Utama" };
    store.save(saved);
    assert.equal(store.auto, false);
    assert.deepEqual(store.slots(world), saved);
    assert.equal(store.slots(world)[0].label, "Utama");

    const reloaded = new ConfigStore(file);
    assert.equal(reloaded.auto, false);
    assert.deepEqual(reloaded.slots(world), saved);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("reset returns the store to automatic and removes the file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "warga-cfg-"));
  const file = path.join(dir, "rooms.json");
  const world = new World();
  world.setGuild(GUILD, "Warung Kopi");

  try {
    const store = new ConfigStore(file);
    const saved = empty();
    saved[0] = { kind: "guild", guildId: GUILD };
    store.save(saved);
    store.reset();
    assert.equal(store.auto, true);
    assert.equal(fs.existsSync(file), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});