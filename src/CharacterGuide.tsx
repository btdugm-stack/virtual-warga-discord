import { useCallback, useEffect, useRef, useState } from "react";
import { CharacterBuilder } from "./CharacterBuilder";
import { COPY } from "./discord/copy";
import type { Kit, Me } from "./discord/types";
import { localized, type Locale, type LocalizedText } from "./i18n";

/** `ticket` values the address can carry besides a real one-time ticket. */
const SIGN_IN_FAILED = "gagal";
const DEMO_TICKET = "demo";

type Phase =
  | { at: "loading" }
  /** Not signed in: explain the ways in. `problem` says why an attempt just failed. */
  | { at: "guest"; problem: LocalizedText | null }
  | { at: "builder"; me: Me };

async function getJson<T>(path: string): Promise<{ status: number; data: T | null }> {
  try {
    const response = await fetch(path);
    return { status: response.status, data: response.ok ? (await response.json()) as T : null };
  } catch {
    return { status: 0, data: null };
  }
}

const post = (path: string, body: unknown = {}) => (
  fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then((response) => response.ok, () => false)
);

/**
 * The character dialog. A signed-in member builds their character here; anyone else is told how to sign in.
 * `ticket` is what a personal link from Discord carried in the address, if the page was opened through one.
 */
export function CharacterGuide({ locale, ticket, demo, onClose }: { locale: Locale; ticket: string | null; demo: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [kit, setKit] = useState<Kit | null>(null);
  const [phase, setPhase] = useState<Phase>({ at: "loading" });

  /** Ask the server who we are. `ticket` is redeemed first when there is one. */
  const signIn = useCallback(async (withTicket: string | null) => {
    setPhase({ at: "loading" });
    let problem: LocalizedText | null = withTicket === SIGN_IN_FAILED ? COPY.signInFailed : null;
    if (withTicket && withTicket !== SIGN_IN_FAILED && !(await post("/api/me/session", { ticket: withTicket }))) problem = COPY.ticketSpent;
    const { status, data } = await getJson<Me>("/api/me");
    if (data) setPhase({ at: "builder", me: data });
    else setPhase({ at: "guest", problem: status === 403 ? COPY.notAMember : status === 0 ? COPY.requestFailed : problem });
  }, []);

  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
    let cancelled = false;
    void getJson<Kit>("/api/kit").then(({ data }) => {
      if (!cancelled) setKit(data);
    });
    void signIn(ticket);
    return () => {
      cancelled = true;
    };
  }, [signIn, ticket]);

  async function signOut() {
    await post("/api/me/logout");
    setPhase({ at: "guest", problem: null });
  }

  return (
    <dialog className="settings-dialog builder-dialog" aria-labelledby="guide-title" onClose={onClose} ref={dialog}>
      <div className="settings-head">
        <h2 id="guide-title">{localized(COPY.guideTitle, locale)}</h2>
        <button aria-label={localized(COPY.guideClose, locale)} className="work-action" onClick={() => dialog.current?.close()} type="button">×</button>
      </div>

      {phase.at === "builder" && kit ? (
        <CharacterBuilder kit={kit} locale={locale} me={phase.me} onSignOut={() => void signOut()} />
      ) : phase.at === "guest" ? (
        <>
          {phase.problem ? <p className="settings-notice" data-bad="true" role="status">{localized(phase.problem, locale)}</p> : null}
          <p className="settings-intro">{localized(COPY.guideIntro, locale)}</p>
          <div className="builder-ways">
            {kit?.oauth ? <a className="work-action" data-forward="true" href="/api/auth/discord">{localized(COPY.signInDiscord, locale)}</a> : null}
            {demo ? (
              <button className="work-action" onClick={() => void signIn(DEMO_TICKET)} type="button">{localized(COPY.signInDemo, locale)}</button>
            ) : null}
          </div>
          <p className="settings-intro">{localized(COPY.guidePhoto, locale)}</p>
          <p className="settings-intro">{localized(COPY.guideActivity, locale)}</p>
          <p className="settings-intro">{localized(COPY.guideEmote, locale)}</p>
          <img alt={localized(COPY.guideCatalogAlt, locale)} className="guide-catalog" height={3706} src="/characters/catalog.png" width={1208} />
        </>
      ) : (
        <p className="settings-intro" role="status">{localized(COPY.linkConnecting, locale)}</p>
      )}
    </dialog>
  );
}
