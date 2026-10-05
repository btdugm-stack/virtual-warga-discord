/**
 * Stand-in for Discord when no DISCORD_TOKEN is set: invented servers and people that come and go,
 * so the office and the settings screen can be tried before a bot exists. Nothing here is real data.
 */

const GUILDS = [
  { id: "900000000000000001", name: "Warung Kopi", text: ["obrolan", "meme"], voice: ["Nongkrong", "Mabar"] },
  { id: "900000000000000002", name: "Pos Ronda", text: ["umum", "pengumuman"], voice: ["Ronda Malam"] },
  { id: "900000000000000003", name: "Karang Taruna", text: ["rapat", "santai"], voice: ["Aula"] },
];
const NAMES = [
  "Budi", "Siti", "Agus", "Dewi", "Joko", "Rina", "Bayu", "Wati", "Eko", "Sari", "Dimas", "Putri",
  "Yanto", "Lina", "Rudi", "Maya", "Hendra", "Tuti", "Fajar", "Indah", "Gilang", "Nita", "Wahyu", "Ayu",
];
const STATUSES = ["online", "online", "online", "idle", "dnd"];
const ACTIVITIES = [
  null, null,
  { kind: "play", name: "Mobile Legends" }, { kind: "play", name: "Valorant" },
  { kind: "listen", name: "Spotify" }, { kind: "watch", name: "YouTube" }, { kind: "stream", name: "Twitch" },
];
const VOICE_STATES = [null, null, "mute", "deaf", "live", "video"];
const REACTIONS = ["😂", "👍", "🔥", "❤️", "😭", "🙏"];
const EMOTES = ["lambai", "joget", "lompat", "putar", "baca"];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function startDemo(world) {
  world.demo = true;
  world.botName = "demo";
  const people = NAMES.map((name, index) => ({
    id: String(800000000000000000n + BigInt(index)),
    name,
    guild: GUILDS[index % GUILDS.length],
  }));

  for (const guild of GUILDS) {
    world.setGuild(guild.id, guild.name);
    guild.text.forEach((name, index) => world.setChannel(guild.id, { id: `${guild.id}1${index}`, name, type: "text" }));
    guild.voice.forEach((name, index) => world.setChannel(guild.id, { id: `${guild.id}2${index}`, name, type: "voice" }));
  }
  for (const person of people) {
    world.addMember(person.guild.id, person.id, person.name);
    if (Math.random() < 0.7) {
      world.setPresence(person.guild.id, person.id, pick(STATUSES), person.name, { silent: true });
      world.setActivity(person.id, pick(ACTIVITIES));
    }
  }
  world.setStatus("ready");

  const channelsOf = (guild, type) => [...world.guilds.get(guild.id).channels.values()].filter((channel) => channel.type === type);

  const timer = setInterval(() => {
    const person = pick(people);
    const user = world.users.get(person.id);
    const roll = Math.random();
    if (user.status === "offline") {
      if (roll < 0.6) world.setPresence(person.guild.id, person.id, "online", person.name);
    } else if (roll < 0.15) {
      world.noteTyping(person.guild.id, person.id, pick(channelsOf(person.guild, "text")).id, person.name);
    } else if (roll < 0.35) {
      world.noteChat(person.guild.id, person.id, pick(channelsOf(person.guild, "text")).id, person.name);
    } else if (roll < 0.45) {
      world.noteReaction(person.guild.id, person.id, { text: pick(REACTIONS) }, person.name);
    } else if (roll < 0.55) {
      world.setEmote(person.id, pick(EMOTES));
    } else if (roll < 0.7) {
      const inVoice = world.voice.has(person.id);
      world.setVoice(person.guild.id, person.id, inVoice ? null : pick(channelsOf(person.guild, "voice")).id, person.name, { state: pick(VOICE_STATES) });
    } else if (roll < 0.8) {
      world.setActivity(person.id, pick(ACTIVITIES));
    } else if (roll < 0.92) {
      world.setPresence(person.guild.id, person.id, pick(STATUSES), person.name);
    } else {
      world.setVoice(person.guild.id, person.id, null, person.name);
      world.setPresence(person.guild.id, person.id, "offline", person.name);
    }
  }, 2500);
  timer.unref();
}
