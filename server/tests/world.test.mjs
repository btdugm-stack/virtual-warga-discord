import assert from "node:assert/strict";
import test from "node:test";
import { ANON_NAME, World } from "../world.mjs";

const GUILD = "111111111111111111";
const publicId = (userId) => `pub-${userId}`;
/** Only `u1` has listed themselves. */
const profileOf = (userId) => ({ sharesProfile: userId === "u1", sharesActivity: userId === "u1" });
/** The server always sends SLOT_COUNT rooms; the corridor index is the one past them, so pad to a full row. */
const slotsWith = (slot) => Array.from({ length: 9 }, (_, index) => (index === 0 ? slot : { kind: "none" }));
const SLOTS = slotsWith({ kind: "guild", guildId: GUILD, label: "Room A" });

function seeded() {
  const world = new World();
  world.setGuild(GUILD, "Server");
  world.setPresence(GUILD, "u1", "online", "Alice");
  world.setPresence(GUILD, "u2", "online", "Bob");
  return world;
}

/** What the server does before every snapshot: mark the bound guilds, then build the public view. */
function view(world, slots) {
  world.setRelevant(slots);
  return world.snapshot(slots, publicId, profileOf);
}

test("an unlisted member is drawn anonymously", () => {
  const { members } = view(seeded(), SLOTS);
  const bob = members.find(({ id }) => id === publicId("u2"));
  assert.ok(bob, "the unlisted member is still on the map");
  assert.equal(bob.name, ANON_NAME);
  assert.equal(bob.presence, "offline");
  assert.equal(bob.voice, null);
  assert.equal(bob.chat, null);
  assert.equal(bob.level, null);
  assert.equal(bob.activity, null);
});

test("a listed member keeps their name and presence", () => {
  const { members } = view(seeded(), SLOTS);
  const alice = members.find(({ id }) => id === publicId("u1"));
  assert.ok(alice);
  assert.equal(alice.name, "Alice");
  assert.equal(alice.presence, "online");
});

test("an unlisted member's room does not reveal their voice channel", () => {
  const world = seeded();
  const voice = "222222222222222222";
  world.setChannel(GUILD, { id: voice, name: "General", type: "voice", viewable: true });
  // Both are listening in the voice channel; only the listed one may be placed by it.
  world.setVoice(GUILD, "u1", voice, "Alice");
  world.setVoice(GUILD, "u2", voice, "Bob");
  const { members } = view(world, slotsWith({ kind: "channel", guildId: GUILD, channelId: voice }));
  const alice = members.find(({ id }) => id === publicId("u1"));
  const bob = members.find(({ id }) => id === publicId("u2"));
  assert.equal(alice.room, 0, "the listed member sits in the voice channel's room");
  assert.notEqual(bob.room, 0, "the unlisted member is not placed by the voice channel");
});

test("an unlisted member's feed line is anonymized and drops their id", () => {
  const world = seeded();
  view(world, SLOTS); // marks the bound guilds
  world.setPresence(GUILD, "u2", "idle", "Bob");
  const { feed } = view(world, SLOTS);
  const line = feed.find((entry) => entry.kind === "idle");
  assert.ok(line, "the event is kept");
  assert.equal(line.name, ANON_NAME);
  assert.ok(!("userId" in line), "the id never reaches the public snapshot");
});
