/**
 * The `/karakter` command: the one way a member changes how they look in the office. Discord tells us who
 * ran it, so nobody can change someone else's character.
 *
 * Nothing is saved when the command is run. It opens a picker only the member can see: a picture of the
 * character, a menu choosing which part to change, a menu with that part's options, and buttons. The choice
 * is applied when they press "Pakai".
 *
 * The picker keeps no state on the server. Every menu and button carries the whole draft in its id, so it
 * still works after a restart.
 */
import { ButtonStyle, ComponentType, MessageFlags } from "discord.js";
import { ACCESSORIES, ACCESSORIES_MAX, PARTS, checkedSpec, codeOf, previewPng, specFor, specOf } from "./character-kit.mjs";

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

const idsOf = (key) => (key === "accessories" ? ACCESSORIES : PARTS.find((part) => part.key === key).ids);

/** `karakter:<action>:<section>:<look code>:<photo>` */
const customId = (action, draft) => [PREFIX, action, draft.section, codeOf(draft.spec), draft.photo ? 1 : 0].join(":");

function parseCustomId(id) {
  const [prefix, action, section, code, photo] = id.split(":");
  if (prefix !== PREFIX) return null;
  if (action === "cancel") return { action, draft: null };
  const spec = specOf(code);
  if (!spec || !SECTIONS[Number(section)] || (photo !== "0" && photo !== "1")) throw new Error("Invalid draft");
  return { action, draft: { spec, section: Number(section), photo: photo === "1" } };
}

function chosenText(spec, key, none) {
  if (key === "accessories") return spec.accessories.length ? spec.accessories.map(named).join(", ") : none;
  return spec[key] === null ? none : named(spec[key]);
}

function summary(draft) {
  const lines = SECTIONS.map(({ key, label, none }) => `**${label}:** ${chosenText(draft.spec, key, none)}`);
  lines.push(`**Foto profil:** ${draft.photo ? "dipakai sebagai wajah (menutupi mata karakter)" : "tidak dipakai"}`);
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
  const options = idsOf(key).map((id) => ({ label: named(id), value: id, default: current.includes(id) }));
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
export function pickerMessage(draft) {
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
    [key]: key === "accessories" ? values : values[0] === NONE ? null : values[0],
  });
  if (!spec) throw new Error("Invalid pick");
  return { ...draft, spec };
}

/**
 * Answers the command and every press on its picker. Returns false for interactions that are not ours.
 * `onApplied` runs after a choice is saved, so the office can be redrawn.
 */
export async function handleKarakter(interaction, characters, onApplied) {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName !== PREFIX) return false;
    // Opens on what the member looks like now. Ephemeral: only they see the picker.
    const draft = { ...characters.look(interaction.user.id), section: 0 };
    await interaction.reply({ ...pickerMessage(draft), flags: MessageFlags.Ephemeral });
    return true;
  }
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return false;
  const parsed = parseCustomId(interaction.customId);
  if (!parsed) return false;
  const userId = interaction.user.id;
  const { action, draft } = parsed;

  switch (action) {
    case "cancel":
      await interaction.update({ content: "Dibatalkan. Karaktermu tidak berubah.", embeds: [], components: [], attachments: [] });
      return true;
    case "apply": {
      // Applying the automatic look saves nothing, so it keeps following the kit if the kit changes.
      const automatic = codeOf(draft.spec) === codeOf(characters.automatic(userId));
      characters.update(userId, { spec: automatic ? null : draft.spec, photo: draft.photo });
      onApplied();
      await interaction.update(appliedMessage(draft));
      return true;
    }
    case "section": {
      const section = Number(interaction.values[0]);
      if (!SECTIONS[section]) throw new Error("Invalid section");
      await interaction.update(pickerMessage({ ...draft, section }));
      return true;
    }
    case "pick":
      await interaction.update(pickerMessage(withPick(draft, interaction.values)));
      return true;
    case "random":
      await interaction.update(pickerMessage({ ...draft, spec: specFor(Math.floor(Math.random() * 2 ** 32)) }));
      return true;
    case "auto":
      await interaction.update(pickerMessage({ ...draft, spec: characters.automatic(userId) }));
      return true;
    case "photo":
      await interaction.update(pickerMessage({ ...draft, photo: !draft.photo }));
      return true;
    default:
      throw new Error("Invalid action");
  }
}
