import type { CSSProperties } from "react";
import { useState } from "react";
import { COPY, SECTION_LABELS, fill } from "./discord/copy";
import type { CharacterSpec, Kit, Me, PartKey } from "./discord/types";
import { localized, type Locale, type LocalizedText } from "./i18n";

type SectionKey = PartKey | "accessories" | "whole";
type Draft = { spec: CharacterSpec; photo: boolean; activity: boolean };

/** `batik_shirt` → `Batik shirt`. The kit names its parts in English ids; this is all the labelling they get. */
const named = (id: string) => (id.charAt(0).toUpperCase() + id.slice(1)).replaceAll("_", " ");

/** The look's code, spelled from the digits the server gave for each option. The server checks it again. */
function codeOf(kit: Kit, spec: CharacterSpec): string {
  const whole = spec.whole ? kit.wholes.find(({ id }) => id === spec.whole) : undefined;
  if (whole) return whole.code;
  const digits = kit.parts.map(({ key, options }) => options.find(({ id }) => id === spec[key])?.digit ?? kit.none);
  const mask = kit.accessories.reduce((bits, { id, bit }) => (spec.accessories.includes(id) ? bits | bit : bits), 0);
  return kit.version + digits.join("") + mask.toString(36).padStart(kit.accessoryDigits, "0");
}

const sheetOf = (kit: Kit, spec: CharacterSpec) => ({ backgroundImage: `url("/api/character/${codeOf(kit, spec)}.png")` }) as CSSProperties;

function randomSpec(kit: Kit): CharacterSpec {
  const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];
  // Most characters go without the optional part (a hat), so a random one stays readable.
  const parts = kit.parts.map(({ key, options, optional }) => [key, optional && Math.random() >= 0.25 ? null : pick(options).id]);
  return {
    ...(Object.fromEntries(parts) as Omit<CharacterSpec, "accessories" | "whole">),
    accessories: Math.random() < 0.5 ? [pick(kit.accessories).id] : [],
    whole: null,
  };
}

/**
 * The character builder: every part of the kit as a picture to click, with the result shown as it will walk
 * around the office. Nothing is saved until "Terapkan". The server knows who this is from the session cookie.
 */
export function CharacterBuilder({ kit, me, locale, onSignOut }: { kit: Kit; me: Me; locale: Locale; onSignOut: () => void }) {
  const [draft, setDraft] = useState<Draft>({ spec: me.spec, photo: me.photo, activity: me.activity });
  const [saved, setSaved] = useState(draft);
  const [section, setSection] = useState<SectionKey>("hair");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: LocalizedText; bad: boolean } | null>(null);

  const change = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setNotice(null);
  };
  // Changing a part means assembling again; otherwise the change would be hidden under a ready-made character.
  const withPart = (key: PartKey, id: string | null): CharacterSpec => ({ ...draft.spec, whole: null, [key]: id });
  const withWhole = (id: string | null): CharacterSpec => ({ ...draft.spec, whole: id });
  const withAccessory = (id: string): CharacterSpec => ({
    ...draft.spec,
    whole: null,
    accessories: draft.spec.accessories.includes(id) ? draft.spec.accessories.filter((other) => other !== id) : [...draft.spec.accessories, id],
  });
  const unsaved = JSON.stringify(draft) !== JSON.stringify(saved);
  const part = kit.parts.find(({ key }) => key === section);
  const accessoriesFull = draft.spec.accessories.length >= kit.accessoriesMax;

  async function apply() {
    setBusy(true);
    let ok = false;
    try {
      const response = await fetch("/api/me/character", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      ok = response.ok;
      if (response.status === 401) {
        onSignOut();
        return;
      }
    } catch {
      // No answer at all; reported as a failed save below.
    } finally {
      setBusy(false);
    }
    if (ok) setSaved(draft);
    setNotice(ok ? { text: COPY.builderSaved, bad: false } : { text: COPY.requestFailed, bad: true });
  }

  /** `spec` is what clicking gives; `shown` is the character drawn on the tile, when that differs. */
  const tile = (key: string, label: string, spec: CharacterSpec, pressed: boolean, disabled = false, shown = spec) => (
    <button aria-pressed={pressed} className="builder-option" disabled={disabled} key={key} onClick={() => change({ spec })} type="button">
      <i aria-hidden="true" style={sheetOf(kit, shown)} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="builder">
      <div className="builder-side">
        <div className="builder-preview" aria-label={localized(COPY.builderPreview, locale)} role="img">
          {["front", "back", "side"].map((view) => <i data-view={view} key={view} style={sheetOf(kit, draft.spec)} />)}
        </div>
        <p className="builder-name">{fill(COPY.builderFor, locale, { name: me.name })}</p>
        <div className="builder-switches">
          <button aria-pressed={draft.photo} className="work-action" onClick={() => change({ photo: !draft.photo })} type="button">
            {localized(draft.photo ? COPY.builderPhotoOn : COPY.builderPhotoOff, locale)}
          </button>
          <button aria-pressed={draft.activity} className="work-action" onClick={() => change({ activity: !draft.activity })} type="button">
            {localized(draft.activity ? COPY.builderActivityOn : COPY.builderActivityOff, locale)}
          </button>
        </div>
        <div className="builder-actions">
          <button className="work-action" onClick={() => change({ spec: randomSpec(kit) })} type="button">{localized(COPY.builderRandom, locale)}</button>
          <button className="work-action" onClick={() => change({ spec: me.automatic })} type="button">{localized(COPY.builderAutomatic, locale)}</button>
          <button className="work-action" data-forward="true" disabled={busy || !unsaved} onClick={() => void apply()} type="button">
            {localized(busy ? COPY.saving : COPY.builderApply, locale)}
          </button>
        </div>
        <p className="settings-notice" data-bad={notice?.bad ? "true" : "false"} role="status">
          {notice ? localized(notice.text, locale) : unsaved ? localized(COPY.builderUnsaved, locale) : ""}
        </p>
        <button className="builder-signout" onClick={onSignOut} type="button">{localized(COPY.builderSignOut, locale)}</button>
      </div>

      <div className="builder-parts">
        <div className="builder-tabs" role="group" aria-label={localized(COPY.builderSections, locale)}>
          {[...(kit.wholes.length ? ["whole" as const] : []), ...kit.parts.map(({ key }) => key), "accessories" as const].map((key) => (
            <button aria-pressed={section === key} key={key} onClick={() => setSection(key)} type="button">
              {localized(SECTION_LABELS[key], locale)}
            </button>
          ))}
        </div>
        <div className="builder-options">
          {section === "whole" ? (
            <>
              {tile("assembled", localized(COPY.builderAssembled, locale), withWhole(null), !draft.spec.whole)}
              {kit.wholes.map(({ id }) => tile(id, named(id), withWhole(id), draft.spec.whole === id))}
            </>
          ) : part ? (
            <>
              {part.optional ? tile("none", localized(COPY.builderNone, locale), withPart(part.key, null), !draft.spec.whole && draft.spec[part.key] === null) : null}
              {part.options.map(({ id }) => tile(id, named(id), withPart(part.key, id), !draft.spec.whole && draft.spec[part.key] === id))}
            </>
          ) : (
            kit.accessories.map(({ id }) => {
              const worn = draft.spec.accessories.includes(id);
              const refused = !worn && accessoriesFull;
              // A tile shows the character wearing its accessory. Clicking a worn one takes it off, and one more
              // than the limit is not a character the server will draw, so those two show things as they are.
              return tile(id, named(id), withAccessory(id), worn && !draft.spec.whole, refused, worn || refused ? { ...draft.spec, whole: null } : withAccessory(id));
            })
          )}
        </div>
        {part || section === "whole" ? null : <p className="settings-intro">{fill(COPY.builderAccessories, locale, { max: kit.accessoriesMax })}</p>}
      </div>
    </div>
  );
}
