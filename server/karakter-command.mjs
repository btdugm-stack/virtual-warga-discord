/**
 * The `/karakter` command: the one way a member changes how they look in the office. Discord tells us who
 * ran it, so nobody can change someone else's character.
 *
 * Nothing is saved when the command is run. It opens a picker only the member can see: a picture of the
 * character, a menu choosing which part to change, a menu with that part's options, and buttons, including
 * the two switches for showing their profile picture and their current activity. The choice is applied when
 * they press "Pakai".
 *
 * Discord drops an interaction that is not acknowledged within three seconds ("Unknown interaction"), and
 * every answer here carries a picture to upload. So each interaction is acknowledged first, with a request
 * that carries nothing, and the picker is sent after.
 *
 * The picker keeps no state on the server. Every menu and button carries the whole draft in its id, so it
 * still works after a restart.
 */
import { ButtonStyle, ComponentType, MessageFlags } from "discord.js";
import { ACCESSORIES, ACCESSORIES_MAX, PARTS, WHOLES, checkedSpec, codeOf, previewPng, specFor, specOf } from "./character-kit.mjs";

const PREFIX = "karakter";
const PREVIEW_NAME = "karakter.png";
/** Menu value for going without (a hat). Part ids never start with a hyphen. */
const NONE = "-";

export const KARAKTER_COMMAND = {
  name: PREFIX,
  description: "Rakit karaktermu di kantor Warga Discord, dengan pratinjau sebelum diterapkan",
};

/** What the picker calls each part, in the order its first menu lists them. */
const SECTIONS = [
  // Offered only when there are ready-made characters. Picking a part afterwards goes back to assembling.
  ...(WHOLES.length ? [{ key: "whole", label: "Karakter jadi", none: "Rakit sendiri" }] : []),
  { key: "body", label: "Kulit" },
  { key: "eyes", label: "Mata" },
  { key: "hair", label: "Gaya rambut" },
  { key: "hairColor", label: "Warna rambut" },
  { key: "top", label: "Atasan" },
  { key: "bottom", label: "Bawahan" },
  { key: "shoes", label: "Sepatu" },
  { key: "hat", label: "Topi", none: "Tanpa topi" },
  { key: "accessories", label: "Aksesori", none: "Tanpa aksesori" },
];

/** `batik_shirt` → `Batik shirt`. The kit names its parts in English ids; this is all the labelling they get. */
const named = (id) => (id.charAt(0).toUpperCase() + id.slice(1)).replaceAll("_", " ");
/** Ready-made characters are named after someone, so every word is capitalised: `ksatria_ezra_peler`. */
const namedWhole = (id) => id.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
const labelFor = (key) => (key === "whole" ? namedWhole : named);

const idsOf = (key) => (key === "accessories" ? ACCESSORIES : key === "whole" ? WHOLES : PARTS.find((part) => part.key === key).ids);

/** `karakter:<action>:<section>:<look code>:<photo><activity>`, the last two as 0 or 1. */
const customId = (action, draft) => [PREFIX, action, draft.section, codeOf(draft.spec), `${draft.photo ? 1 : 0}${draft.activity ? 1 : 0}`].join(":");

function parseCustomId(id) {
  const [prefix, action, section, code, switches = ""] = id.split(":");
  if (prefix !== PREFIX) return null;
  if (action === "cancel") return { action, draft: null };
  const spec = specOf(code);
  if (!spec || !SECTIONS[Number(section)] || !/^[01]{2}$/.test(switches)) throw new Error("Invalid draft");
  return { action, draft: { spec, section: Number(section), photo: switches[0] === "1", activity: switches[1] === "1" } };
}

function chosenText(spec, key, none) {
  if (key === "accessories") return spec.accessories.length ? spec.accessories.map(named).join(", ") : none;
  return spec[key] === null || spec[key] === undefined ? none : labelFor(key)(spec[key]);
}

function summary(draft) {
  // A ready-made character hides the parts, so listing them would only mislead.
  const lines = SECTIONS
    .filter(({ key }) => !draft.spec.whole || key === "whole")
    .map(({ key, label, none }) => `**${label}:** ${chosenText(draft.spec, key, none)}`);
  lines.push(`**Foto profil:** ${draft.photo ? "dipakai sebagai wajah (menutupi mata karakter)" : "tidak dipakai"}`);
  lines.push(`**Aktivitas:** ${draft.activity ? "game atau musik yang sedang kamu buka ikut ditampilkan" : "tidak ditampilkan"}`);
  return lines.join("\n");
}

function sectionMenu(draft) {
  return {
    type: ComponentType.ActionRow,
    components: [{
      type: ComponentType.StringSelect,
      custom_id: customId("section", draft),
      options: SECTIONS.map(({ key, label, none }, index) => ({
        label: `Ubah: ${label}`,
        description: chosenText(draft.spec, key, none).slice(0, 100),
        value: String(index),
        default: index === draft.section,
      })),
    }],
  };
}

function optionMenu(draft) {
  const { key, none } = SECTIONS[draft.section];
  const several = key === "accessories";
  const current = several ? draft.spec.accessories : [draft.spec[key] ?? NONE];
  const options = idsOf(key).map((id) => ({ label: labelFor(key)(id), value: id, default: current.includes(id) }));
  // Several accessories can be picked at once, and picking none of them is how to go without.
  if (none && !several) options.unshift({ label: none, value: NONE, default: current.includes(NONE) });
  return {
    type: ComponentType.ActionRow,
    components: [{
      type: ComponentType.StringSelect,
      custom_id: customId("pick", draft),
      options,
      ...(several ? { min_values: 0, max_values: ACCESSORIES_MAX, placeholder: `${none} (pilih sampai ${ACCESSORIES_MAX})` } : {}),
    }],
  };
}

function preview(draft) {
  return { attachment: previewPng(draft.spec), name: PREVIEW_NAME };
}

/** The picker as it stands for one draft: what the character would look like, and the controls to change it. */
export function pickerMessage(draft, siteUrl = null) {
  const button = (action, label, style = ButtonStyle.Secondary) => ({ type: ComponentType.Button, style, label, custom_id: customId(action, draft) });
  return {
    content: "",
    embeds: [{
      title: "Pratinjau karaktermu",
      description: `${summary(draft)}\n\nBelum diterapkan. Pilih bagian di menu pertama, pilih isinya di menu kedua, lalu tekan **Pakai**.`,
      image: { url: `attachment://${PREVIEW_NAME}` },
    }],
    files: [preview(draft)],
    components: [
      sectionMenu(draft),
      optionMenu(draft),
      {
        type: ComponentType.ActionRow,
        components: [
          button("apply", "Pakai", ButtonStyle.Success),
          button("random", "Acak"),
          button("auto", "Bawaan"),
          button("photo", draft.photo ? "Foto profil: dipakai" : "Foto profil: tidak dipakai"),
          { type: ComponentType.Button, style: ButtonStyle.Secondary, label: "Batal", custom_id: `${PREFIX}:cancel` },
        ],
      },
      // A row holds five buttons at most; the second switch gets its own.
      {
        type: ComponentType.ActionRow,
        components: [
          button("activity", draft.activity ? "Aktivitas: ditampilkan" : "Aktivitas: tidak ditampilkan"),
          // The same choices with pictures to click, on the site. The link signs this member in there, once.
          ...(siteUrl ? [{ type: ComponentType.Button, style: ButtonStyle.Link, label: "Rakit di situs", url: siteUrl }] : []),
        ],
      },
    ],
  };
}

function appliedMessage(draft) {
  return {
    content: "",
    embeds: [{
      title: "Karakter diterapkan",
      description: `${summary(draft)}\n\nSudah tampil di kantor. Jalankan \`/karakter\` lagi kapan saja untuk menggantinya.`,
      image: { url: `attachment://${PREVIEW_NAME}` },
    }],
    files: [preview(draft)],
    components: [],
  };
}

/** Put the picked menu values into the draft. Throws when they do not name parts the kit has. */
function withPick(draft, values) {
  const { key } = SECTIONS[draft.section];
  const spec = checkedSpec({
    ...draft.spec,
    // Changing a part means assembling again; otherwise the change would be hidden under the ready-made character.
    whole: null,
    [key]: key === "accessories" ? values : values[0] === NONE ? null : values[0],
  });
  if (!spec) throw new Error("Invalid pick");
  return { ...draft, spec };
}

/**
 * Answers the command and every press on its picker. Returns false for interactions that are not ours.
 * `onApplied` runs after a choice is saved, so the office can be redrawn. `siteLinkFor`, when given, makes
 * the personal link to the site's builder for a member.
 */
export async function handleKarakter(interaction, characters, onApplied, siteLinkFor = () => null) {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName !== PREFIX) return false;
    // Opens on what the member looks like now. Ephemeral: only they see the picker.
    const draft = { ...characters.look(interaction.user.id), section: 0 };
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply(pickerMessage(draft, siteLinkFor(interaction.user.id)));
    return true;
  }
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return false;
  const parsed = parseCustomId(interaction.customId);
  if (!parsed) return false;
  const userId = interaction.user.id;
  const { action, draft } = parsed;
  await interaction.deferUpdate();
  const picker = (next) => pickerMessage(next, siteLinkFor(userId));

  switch (action) {
    case "cancel":
      await interaction.editReply({ content: "Dibatalkan. Karaktermu tidak berubah.", embeds: [], components: [], attachments: [] });
      return true;
    case "apply": {
      // Applying the automatic look saves nothing, so it keeps following the kit if the kit changes.
      const automatic = codeOf(draft.spec) === codeOf(characters.automatic(userId));
      characters.update(userId, { spec: automatic ? null : draft.spec, photo: draft.photo, activity: draft.activity });
      onApplied();
      await interaction.editReply(appliedMessage(draft));
      return true;
    }
    case "section": {
      const section = Number(interaction.values[0]);
      if (!SECTIONS[section]) throw new Error("Invalid section");
      await interaction.editReply(picker({ ...draft, section }));
      return true;
    }
    case "pick":
      await interaction.editReply(picker(withPick(draft, interaction.values)));
      return true;
    case "random":
      await interaction.editReply(picker({ ...draft, spec: specFor(Math.floor(Math.random() * 2 ** 32)) }));
      return true;
    case "auto":
      await interaction.editReply(picker({ ...draft, spec: characters.automatic(userId) }));
      return true;
    case "photo":
      await interaction.editReply(picker({ ...draft, photo: !draft.photo }));
      return true;
    case "activity":
      await interaction.editReply(picker({ ...draft, activity: !draft.activity }));
      return true;
    default:
      throw new Error("Invalid action");
  }
}
