/**
 * The office's seating rules, exercised through the public World API exactly as the Discord and demo sources
 * call it. Cases follow `world.mjs#snapshot` docs: voice channel, then last chat, then the AFK room, then the
 * room bound to the server; an active member of a shown server whom none of that places stands in the corridor;
 * offline members are shown only in the AFK room.
 */
import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { CORRIDOR, ROOM_CAP, SLOT_COUNT, World } from "../world.mjs";

const GUILD = "100000000000000001";
const GUILD2 = "100000000000000002";
const VOICE = "200000000000000001";
const TEXT = "200000000000000002";
const SECRET = "200000000000000003";
const ID = (userId) => userId;

const CHAT_ROOM_MS = 5 * 60_000;
const CHAT_BUBBLE_MS = 60_000;
const CHAT_FEED_GAP_MS = 3 * 60_000;
const TYPING_MS = 10_000;
const REACTION_MS = 6_000;

/** A world with one voice and one text channel in GUILD, and a second server with no channels. */
function makeWorld() {
  const world = new World();
  world.setGuild(GUILD, "Warung Kopi");
  world.setChannel(GUILD, { id: VOICE, name: "Nongkrong", type: "voice", viewable: true });
  world.setChannel(GUILD, { id: TEXT, name: "obrolan", type: "text", viewable: true });
  world.setGuild(GUILD2, "Pos Ronda");
  return world;
}

/** Nine slot objects, with the given (index → slot) overrides. */
function slotsOf(overrides = {}) {
  const slots = Array.from({ length: SLOT_COUNT }, () => ({ kind: "none" }));
  for (const [index, slot] of Object.entries(overrides)) slots[Number(index)] = slot;
  return slots;
}

const snapshotOf = (world, slots, now = Date.now()) => {
  world.setRelevant(slots);
  return world.snapshot(slots, ID, () => ({}), now);
};
const memberById = (snapshot, id) => snapshot.members.find((member) => member.id === id);

afterEach(() => mock.timers.reset());

test("a member in voice sits in the bound voice channel's room, not their server's room", () => {
  const world = makeWorld();
  world.setPresence(GUILD, "111", "online", "Alice", { silent: true });
  world.setVoice(GUILD, "111", VOICE, "Alice", { silent: true });
  const slots = slotsOf({ 0: { kind: "channel", guildId: GUILD, channelId: VOICE }, 1: { kind: "guild", guildId: GUILD } });

  const snapshot = snapshotOf(world, slots);

  const alice = memberById(snapshot, "111");
  assert.equal(alice.room, 0, "voice wins over the guild room");
  assert.equal(alice.voice, "Nongkrong");
  assert.equal(alice.rank, undefined, "the rank internal to sorting is not sent");
  assert.equal(snapshot.rooms[0].kind, "channel");
  assert.equal(snapshot.rooms[0].live, true, "someone in voice makes the room live");
});

test("a member who last wrote sits in the text channel's room while the chat is fresh", () => {
  const world = makeWorld();
  world.setPresence(GUILD, "222", "online", "Budi", { silent: true });
  world.noteChat(GUILD, "222", TEXT, "Budi", 1_000_000);
  // Snapshot 30 s after the message: inside the room window (5 min) and the bubble window (1 min).
  const slots = slotsOf({ 1: { kind: "channel", guildId: GUILD, channelId: TEXT } });

  const snapshot = snapshotOf(world, slots, 1_030_000);

  const budi = memberById(snapshot, "222");
  assert.equal(budi.room, 1, "the chat room, not the corridor");
  assert.equal(budi.chat, "obrolan");
});

test("the room's chat bubble disappears a minute after the message but the member stays seated", () => {
  const world = makeWorld();
  world.setPresence(GUILD, "222", "online", "Budi", { silent: true });
  world.noteChat(GUILD, "222", TEXT, "Budi", 1_000_000);
  const slots = slotsOf({ 1: { kind: "channel", guildId: GUILD, channelId: TEXT } });

  const later = snapshotOf(world, slots, 1_000_000 + CHAT_BUBBLE_MS + 1);

  const budi = memberById(later, "222");
  assert.equal(budi.room, 1, "still inside the five-minute room window");
  assert.equal(budi.chat, null, "the bubble is gone");
});

test("an idle member of a shown server sits in the AFK room when one exists", () => {
  const world = makeWorld();
  world.setPresence(GUILD, "333", "idle", "Citra", { silent: true });
  const slots = slotsOf({
    0: { kind: "guild", guildId: GUILD },
    2: { kind: "idle" },
  });

  const snapshot = snapshotOf(world, slots);

  assert.equal(memberById(snapshot, "333").room, 2, "idle members sit in the AFK room");
});

test("an offline member is shown only when an AFK room exists", () => {
  const world = makeWorld();
  // Offline members are known only after they have been seen; the discord source syncs the whole member list first.
  world.setPresence(GUILD, "444", "online", "Dina", { silent: true });
  world.setPresence(GUILD, "444", "offline", "Dina", { silent: true });

  assert.equal(memberById(snapshotOf(world, slotsOf({ 0: { kind: "guild", guildId: GUILD } })), "444"), undefined);
  assert.equal(memberById(snapshotOf(world, slotsOf({ 0: { kind: "guild", guildId: GUILD }, 2: { kind: "idle" } })), "444").room, 2);
});

test("an active member of a shown server whom no room fits stands in the corridor", () => {
  const world = makeWorld();
  world.setPresence(GUILD, "555", "online", "Eka", { silent: true });
  // A channel room is bound (making the server relevant) but Eka is in neither that channel nor voice nor the AFK room.
  const slots = slotsOf({ 0: { kind: "channel", guildId: GUILD, channelId: VOICE } });

  const snapshot = snapshotOf(world, slots);

  assert.equal(memberById(snapshot, "555").room, CORRIDOR);
});

test("a member online in a server the office does not show is not seated at all", () => {
  const world = makeWorld();
  world.setPresence(GUILD2, "777", "online", "Farah", { silent: true });
  const slots = slotsOf({ 0: { kind: "guild", guildId: GUILD } });

  assert.equal(memberById(snapshotOf(world, slots), "777"), undefined);
});

test("a room counts its overflow and sends at most ROOM_CAP members", () => {
  const world = makeWorld();
  const count = ROOM_CAP + 2;
  for (let i = 0; i < count; i += 1) {
    // Zero-padded names, so the seat ordering follows the numeric order and the last two fall out of the cap.
    world.setPresence(GUILD, `id${i}`, "online", `Warga ${String(i).padStart(2, "0")}`, { silent: true });
  }
  const slots = slotsOf({ 0: { kind: "guild", guildId: GUILD } });

  const snapshot = snapshotOf(world, slots);

  assert.equal(snapshot.rooms[0].total, count);
  assert.equal(snapshot.rooms[0].overflow, count - ROOM_CAP);
  assert.equal(snapshot.members.length, ROOM_CAP);
  assert.ok(memberById(snapshot, "id0"), "the first seated member is kept");
  assert.equal(memberById(snapshot, `id${ROOM_CAP}`), undefined, "the overflow members are folded into +N");
});

test("in one room, active members are seated before the merely present", () => {
  const world = makeWorld();
  world.setPresence(GUILD, "996", "online", "Budi", { silent: true });
  world.setPresence(GUILD, "997", "online", "Cahyo", { silent: true });
  // Budi wrote 30 s ago (rank 1); Cahyo wrote 2 min ago (bubble gone, rank 2). Both are within the 5-min room window.
  world.noteChat(GUILD, "996", TEXT, "Budi", 1_000_000);
  world.noteChat(GUILD, "997", TEXT, "Cahyo", 960_000);
  const slots = slotsOf({ 0: { kind: "channel", guildId: GUILD, channelId: TEXT } });
  const now = 1_030_000;

  const snapshot = snapshotOf(world, slots, now);

  const seated = snapshot.members.filter((member) => member.room === 0);
  assert.deepEqual(seated.map((member) => member.id), ["996", "997"], "the recent chatter is seated first");
});

test("a voice state travels with the member", () => {
  const world = makeWorld();
  world.setPresence(GUILD, "111", "online", "Alice", { silent: true });
  world.setVoice(GUILD, "111", VOICE, "Alice", { silent: true, state: "mute" });

  const member = memberById(snapshotOf(world, slotsOf({ 0: { kind: "channel", guildId: GUILD, channelId: VOICE } })), "111");

  assert.equal(member.voice, "Nongkrong");
  assert.equal(member.voiceState, "mute");
});

test("a bound channel the bot cannot see is marked blocked", () => {
  const world = makeWorld();
  world.setChannel(GUILD, { id: SECRET, name: "rapat", type: "text", viewable: false });

  const snapshot = snapshotOf(world, slotsOf({ 0: { kind: "channel", guildId: GUILD, channelId: SECRET } }));

  assert.equal(snapshot.rooms[0].blocked, true);
});

test("a bound server or channel the bot no longer sees is marked missing", () => {
  const world = makeWorld();

  const missing = snapshotOf(world, slotsOf({ 0: { kind: "guild", guildId: "999999999999999999" } }));
  assert.equal(missing.rooms[0].missing, true);
  assert.equal(missing.rooms[0].title, "");
});

test("sweep drops chats older than the room window, so the member falls back to their server's room", () => {
  const world = makeWorld();
  world.setPresence(GUILD, "777", "online", "Galih", { silent: true });
  world.noteChat(GUILD, "777", TEXT, "Galih", 1_000_000);
  const slots = slotsOf({
    0: { kind: "channel", guildId: GUILD, channelId: TEXT },
    1: { kind: "guild", guildId: GUILD },
  });

  const fresh = snapshotOf(world, slots, 1_010_000);
  assert.equal(memberById(fresh, "777").room, 0);

  world.sweep(1_000_000 + CHAT_ROOM_MS + 1);
  const swept = snapshotOf(world, slots, 1_000_000 + CHAT_ROOM_MS + 1);
  const galih = memberById(swept, "777");
  assert.equal(galih.chat, null);
  assert.equal(galih.room, 1, "seated by server once the chat expires");
});

test("the feed shows a chat once per person per three minutes", () => {
  const world = makeWorld();
  world.setPresence(GUILD, "888", "online", "Hana", { silent: true });
  const slots = slotsOf({ 0: { kind: "channel", guildId: GUILD, channelId: TEXT } });
  world.setRelevant(slots);

  world.noteChat(GUILD, "888", TEXT, "Hana", 1_000_000);
  assert.equal(world.feed.length, 1, "the first message is in the feed");

  world.noteChat(GUILD, "888", TEXT, "Hana", 1_001_000);
  assert.equal(world.feed.length, 1, "a second message inside the gap is not another line");

  world.noteChat(GUILD, "888", TEXT, "Hana", 1_000_000 + CHAT_FEED_GAP_MS + 1);
  assert.equal(world.feed.length, 2, "after the gap a new line appears");
  assert.equal(world.feed[0].kind, "chat");
  assert.equal(world.feed[0].where, "obrolan");
});

test("typing shows for about ten seconds and then clears on its own", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const world = makeWorld();
  world.setPresence(GUILD, "999", "online", "Indra", { silent: true });
  const slots = slotsOf({ 0: { kind: "channel", guildId: GUILD, channelId: VOICE } });
  world.setRelevant(slots);

  world.noteTyping(GUILD, "999", VOICE, "Indra");
  assert.equal(memberById(snapshotOf(world, slots), "999").typing, "Nongkrong");

  mock.timers.tick(TYPING_MS + 1);
  assert.equal(memberById(snapshotOf(world, slots), "999").typing, null);
});

test("a reaction floats for a few seconds and then clears on its own", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const world = makeWorld();
  world.setPresence(GUILD, "999", "online", "Indra", { silent: true });
  const slots = slotsOf({ 0: { kind: "channel", guildId: GUILD, channelId: TEXT } });
  world.setRelevant(slots);

  world.noteReaction(GUILD, "999", { text: "🔥" }, "Indra");
  assert.equal(memberById(snapshotOf(world, slots), "999").reaction.text, "🔥");

  mock.timers.tick(REACTION_MS + 1);
  assert.equal(memberById(snapshotOf(world, slots), "999").reaction, null);
});