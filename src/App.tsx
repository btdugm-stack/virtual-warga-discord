import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { COMPANY, THEME } from "./company.config";
import { COPY, FEED_LABELS, PRESENCE_LABELS, fill } from "./discord/copy";
import { activityText, roomNote, roomTitle } from "./discord/rooms";
import type { Member, RoomState, Snapshot } from "./discord/types";
import { useDiscord, type LinkState } from "./discord/useDiscord";
import { ROOM_ZONES } from "./game/office-world";
import { LOCALES, LOCALE_LABELS, checkedLocale, localized, type Locale, type LocalizedText } from "./i18n";
import { OfficeWorld } from "./OfficeWorld";
import { SettingsPanel } from "./SettingsPanel";

const themeStyle = {
  "--color-app": THEME.app,
  "--color-frame": THEME.frame,
  "--color-panel": THEME.panel,
  "--color-surface": THEME.surface,
  "--color-line": THEME.line,
  "--color-edge": THEME.edge,
  "--color-floor": THEME.floor,
  "--color-cream": THEME.cream,
  "--color-ink": THEME.ink,
  "--color-muted": THEME.muted,
  "--color-skin": THEME.skin,
  "--color-wood": THEME.wood,
  "--color-wood-dark": THEME.woodDark,
  "--color-screen": THEME.screen,
  "--color-green": THEME.green,
  "--color-amber": THEME.amber,
  "--color-red": THEME.red,
  "--color-focus": THEME.focus,
  "--color-shadow": THEME.shadow,
} as CSSProperties;

const LOCALE_STORAGE_KEY = "warga.locale";
/** BCP 47 tags for date formatting. The UI locale codes are not all valid on their own (`zh` is ambiguous). */
const DATE_LOCALES: Record<Locale, string> = { ko: "ko-KR", en: "en-GB", zh: "zh-CN", vi: "vi-VN", id: "id-ID" };

type Pane = "office" | "feed" | "roster";
const PANES = [
  { id: "office", label: COPY.tabOffice },
  { id: "feed", label: COPY.tabFeed },
  { id: "roster", label: COPY.tabRoster },
] as const satisfies readonly { id: Pane; label: LocalizedText }[];

// Stable empties: a new array each render would make the office re-seat everyone.
const NO_ROOMS: readonly RoomState[] = [];
const NO_MEMBERS: readonly Member[] = [];

function initialLocale(): Locale {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    // Storage can be blocked; the browser language still gives a sensible start.
  }
  return checkedLocale(stored ?? navigator.language.slice(0, 2).toLowerCase());
}

/** Wall-clock time, refreshed often enough that the minute never lags visibly. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/** At most one line under the room strip, the most pressing problem first. */
function warningFor(snapshot: Snapshot | null, link: LinkState): LocalizedText | null {
  if (link === "lost") return COPY.warnLost;
  if (!snapshot) return null;
  if (snapshot.status === "error") {
    return snapshot.errorCode === "token" ? COPY.warnToken : snapshot.errorCode === "intents" ? COPY.warnIntents : COPY.warnUnknown;
  }
  if (snapshot.status === "connecting") return COPY.warnBotConnecting;
  if (snapshot.demo) return COPY.warnDemo;
  if (snapshot.rooms.every(({ kind }) => kind === "none")) return COPY.warnNoRooms;
  return null;
}

export function App() {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const { snapshot, link } = useDiscord();
  const [pane, setPane] = useState<Pane>("office");
  const [activeRoom, setActiveRoom] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const now = useNow();

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = localized(COMPANY.pageTitle, locale);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // The language still applies for this visit.
    }
  }, [locale]);

  const rooms = snapshot?.rooms ?? NO_ROOMS;
  const members = snapshot?.members ?? NO_MEMBERS;
  const feed = snapshot?.feed ?? [];
  const warning = warningFor(snapshot, link);
  const clockTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const feedTime = useMemo(
    () => new Intl.DateTimeFormat(DATE_LOCALES[locale], { hour: "2-digit", minute: "2-digit" }),
    [locale],
  );
  const linkText = link !== "live" ? COPY.linkConnecting : snapshot?.demo ? COPY.linkDemo : COPY.linkLive;

  return (
    <div className="app-shell moonlab-shell" data-draftroom-shell="" style={themeStyle}>
      <header className="app-bar">
        <div className="app-name">
          <h1>{COMPANY.name}</h1>
          <p>{localized(COMPANY.tagline, locale)}</p>
        </div>
        <span className="app-storage" data-link={link} role="status">{localized(linkText, locale)}</span>
        <label className="app-language">
          <span>{localized(COPY.language, locale)}</span>
          <select onChange={(event) => setLocale(checkedLocale(event.target.value))} value={locale}>
            {LOCALES.map((code) => (
              <option key={code} value={code}>{LOCALE_LABELS[code]}</option>
            ))}
          </select>
        </label>
        <button className="work-action app-settings" onClick={() => setSettingsOpen(true)} type="button">
          {localized(COPY.settingsOpen, locale)}
        </button>
      </header>

      <div className="app-deck">
        <ol className="workflow-strip room-strip" aria-label={localized(COPY.stripLabel, locale)}>
          {ROOM_ZONES.map((zone, index) => {
            const room = rooms[index];
            return (
              <li key={zone.id}>
                <button
                  aria-pressed={activeRoom === index}
                  className="workflow-step"
                  data-active={activeRoom === index ? "true" : "false"}
                  data-status={room?.live ? "running" : "idle"}
                  onClick={() => setActiveRoom((current) => (current === index ? null : index))}
                  title={room?.subtitle || undefined}
                  type="button"
                >
                  <span className="workflow-step-code" style={{ "--zone-accent": zone.accent } as CSSProperties}>{zone.code}</span>
                  <strong>{roomTitle(room, index, locale)}</strong>
                  <span className="workflow-step-status">{roomNote(room, locale)}</span>
                </button>
              </li>
            );
          })}
        </ol>

        {warning ? <p className="app-warning" role="status">{localized(warning, locale)}</p> : null}
      </div>

      <div className="pane-tabs" role="group" aria-label={localized(COPY.paneTabs, locale)}>
        {PANES.map(({ id, label }) => (
          <button aria-pressed={pane === id} key={id} onClick={() => setPane(id)} type="button">
            {localized(label, locale)}
          </button>
        ))}
      </div>

      <div className="workspace-layout" data-pane={pane}>
        <section className="office-panel">
          <OfficeWorld
            activeRoom={activeRoom}
            clock={{ label: localized(COPY.clock, locale), time: clockTime }}
            locale={locale}
            members={members}
            ready={true}
            rooms={rooms}
          />
        </section>

        <aside className="work-dock">
          <section className="feed-panel" aria-labelledby="feed-title">
            <h2 id="feed-title">{localized(COPY.feedTitle, locale)}</h2>
            {feed.length === 0 ? (
              <p className="work-empty">{localized(COPY.feedEmpty, locale)}</p>
            ) : (
              <ol>
                {feed.map((entry) => (
                  <li data-kind={entry.kind} key={entry.id}>
                    <time dateTime={entry.at}>{feedTime.format(new Date(entry.at))}</time>
                    <div>
                      <strong>{entry.name}</strong>{" "}
                      <span>{fill(FEED_LABELS[entry.kind], locale, { where: entry.where })}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="roster-panel" aria-labelledby="roster-title">
            <h2 id="roster-title">{localized(COPY.rosterTitle, locale)}</h2>
            {members.length === 0 ? <p className="work-empty">{localized(COPY.rosterEmpty, locale)}</p> : null}
            {ROOM_ZONES.map((zone, index) => {
              const here = members.filter(({ room }) => room === index);
              if (!here.length) return null;
              const hidden = rooms[index]?.overflow ?? 0;
              return (
                <section className="work-group" key={zone.id}>
                  <h3>
                    <span className="work-group-code" style={{ "--zone-accent": zone.accent } as CSSProperties}>{zone.code}</span>
                    {roomTitle(rooms[index], index, locale)}
                    <small>{rooms[index]?.total ?? here.length}</small>
                  </h3>
                  <ul className="roster-list">
                    {here.map((member) => (
                      <li data-presence={member.presence} key={member.id}>
                        <i aria-hidden="true" />
                        <strong>{member.name}</strong>
                        <span>
                          <span className="visually-hidden">{localized(PRESENCE_LABELS[member.presence], locale)} · </span>
                          {activityText(member, locale)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {hidden ? <p className="roster-more">{fill(COPY.roomOverflow, locale, { count: hidden })}</p> : null}
                </section>
              );
            })}
          </section>
        </aside>
      </div>

      {settingsOpen ? <SettingsPanel locale={locale} onClose={() => setSettingsOpen(false)} /> : null}
    </div>
  );
}
