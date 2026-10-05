/**
 * The `/emote` command: a member makes their character do something in the office for a few seconds.
 * The moves themselves are drawn by the page (`src/app.css`); `src/discord/types.ts` lists the same kinds.
 */
import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { EMOTE_MS } from "./world.mjs";

const EMOTES = [
  { kind: "lambai", label: "Lambai", done: "melambai" },
  { kind: "joget", label: "Joget", done: "berjoget" },
  { kind: "lompat", label: "Lompat", done: "melompat-lompat" },
  { kind: "putar", label: "Putar", done: "berputar" },
  { kind: "baca", label: "Baca", done: "membaca" },
];

export const EMOTE_COMMAND = {
  name: "emote",
  description: "Buat karaktermu bergerak di kantor Warga Discord",
  options: [{
    type: ApplicationCommandOptionType.String,
    name: "gerakan",
    description: "Gerakan yang dilakukan karaktermu",
    required: true,
    choices: EMOTES.map(({ kind, label }) => ({ name: label, value: kind })),
  }],
};

/** Answers the command. Returns false for interactions that are not ours. */
export async function handleEmote(interaction, world) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== EMOTE_COMMAND.name) return false;
  const emote = EMOTES.find(({ kind }) => kind === interaction.options.getString("gerakan"));
  if (!emote) throw new Error("Invalid emote");
  const shown = world.setEmote(interaction.user.id, emote.kind);
  // Ephemeral: only the member who ran the command sees the answer.
  await interaction.reply({
    content: shown
      ? `Karaktermu ${emote.done} di kantor selama ${Math.round(EMOTE_MS / 1000)} detik.`
      : "Karaktermu belum ada di kantor. Coba lagi setelah kamu terlihat online di sana.",
    flags: MessageFlags.Ephemeral,
  });
  return true;
}
