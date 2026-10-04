import { useEffect, useRef } from "react";
import { COPY } from "./discord/copy";
import { localized, type Locale } from "./i18n";

/** Explains `/karakter` and shows the parts to choose from. Choosing happens in Discord, where the member's identity is known. */
export function CharacterGuide({ locale, onClose }: { locale: Locale; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
  }, []);

  return (
    <dialog className="settings-dialog" aria-labelledby="guide-title" onClose={onClose} ref={dialog}>
      <div className="settings-head">
        <h2 id="guide-title">{localized(COPY.guideTitle, locale)}</h2>
        <button aria-label={localized(COPY.guideClose, locale)} className="work-action" onClick={() => dialog.current?.close()} type="button">×</button>
      </div>
      <p className="settings-intro">{localized(COPY.guideIntro, locale)}</p>
      <p className="settings-intro">{localized(COPY.guideParts, locale)}</p>
      <p className="settings-intro">{localized(COPY.guidePhoto, locale)}</p>
      <img alt={localized(COPY.guideCatalogAlt, locale)} className="guide-catalog" height={3706} src="/characters/catalog.png" width={1208} />
    </dialog>
  );
}
