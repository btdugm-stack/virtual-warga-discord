import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { COPY } from "./discord/copy";
import { SLOT_COUNT, SLOT_LABEL_MAX, type AdminConfig, type RoomKind, type Slot } from "./discord/types";
import { ROOM_ZONES } from "./game/office-world";
import { localized, type Locale, type LocalizedText } from "./i18n";

/** The admin token is kept for the tab only: closing the tab signs out. */
const TOKEN_STORAGE_KEY = "warga.admin";

/** A slot as the form holds it: every field present, so switching kinds never loses what was picked. */
type Draft = { kind: RoomKind; guildId: string; channelId: string; label: string };

const KINDS = [
  { kind: "none", label: COPY.kindNone },
  { kind: "guild", label: COPY.kindGuild },
  { kind: "channel", label: COPY.kindChannel },
  { kind: "idle", label: COPY.kindIdle },
] as const satisfies readonly { kind: RoomKind; label: LocalizedText }[];

function draftOf(slot: Slot | undefined): Draft {
  return {
    kind: slot?.kind ?? "none",
    guildId: slot && "guildId" in slot ? slot.guildId : "",
    channelId: slot && "channelId" in slot ? slot.channelId : "",
    label: slot && "label" in slot ? slot.label ?? "" : "",
  };
}

/** Null when the room is half filled in. */
function slotOf(draft: Draft): Slot | null {
  const label = draft.label.trim();
  const named = label ? { label } : {};
  if (draft.kind === "none") return { kind: "none" };
  if (draft.kind === "idle") return { kind: "idle", ...named };
  if (!draft.guildId) return null;
  if (draft.kind === "guild") return { kind: "guild", guildId: draft.guildId, ...named };
  return draft.channelId ? { kind: "channel", guildId: draft.guildId, channelId: draft.channelId, ...named } : null;
}

function storedToken() {
  try {
    return window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null) {
  try {
    if (token) window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Without storage the token still works until the panel closes.
  }
}

/** Status 0 stands for "no answer at all". */
async function request<T>(path: string, token: string | null, method = "GET", body?: unknown): Promise<{ status: number; data: T | null }> {
  try {
    const response = await fetch(path, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: response.ok ? (await response.json()) as T : null };
  } catch {
    return { status: 0, data: null };
  }
}

export function SettingsPanel({ locale, onClose }: { locale: Locale; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [token, setToken] = useState(storedToken);
  const [password, setPassword] = useState("");
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [drafts, setDrafts] = useState<readonly Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: LocalizedText; bad: boolean } | null>(null);

  const adopt = useCallback((next: AdminConfig) => {
    setConfig(next);
    setDrafts(Array.from({ length: SLOT_COUNT }, (_, index) => draftOf(next.slots[index])));
  }, []);

  const signOut = useCallback((text: LocalizedText) => {
    storeToken(null);
    setToken(null);
    setConfig(null);
    setNotice({ text, bad: true });
  }, []);

  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void request<AdminConfig>("/api/admin/config", token).then(({ status, data }) => {
      if (cancelled) return;
      if (data) adopt(data);
      else if (status === 401) signOut(COPY.sessionExpired);
      else setNotice({ text: COPY.requestFailed, bad: true });
    });
    return () => {
      cancelled = true;
    };
  }, [adopt, signOut, token]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    const { status, data } = await request<{ token: string }>("/api/admin/login", null, "POST", { password });
    setBusy(false);
    if (data) {
      storeToken(data.token);
      setToken(data.token);
      setPassword("");
      setNotice(null);
      return;
    }
    setNotice({
      text: status === 401 ? COPY.loginWrong : status === 429 ? COPY.loginLimited : status === 503 ? COPY.loginDisabled : COPY.requestFailed,
      bad: true,
    });
  }

  async function send(body: { slots: Slot[] } | { auto: true }) {
    setBusy(true);
    const { status, data } = await request<AdminConfig>("/api/admin/config", token, "PUT", body);
    setBusy(false);
    if (data) {
      adopt(data);
      setNotice({ text: COPY.saved, bad: false });
    } else if (status === 401) signOut(COPY.sessionExpired);
    else setNotice({ text: COPY.requestFailed, bad: true });
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const slots = drafts.map(slotOf);
    if (slots.some((slot) => slot === null)) {
      setNotice({ text: COPY.saveIncomplete, bad: true });
      return;
    }
    void send({ slots: slots as Slot[] });
  }

  function change(index: number, patch: Partial<Draft>) {
    setDrafts((current) => current.map((draft, at) => (at === index ? { ...draft, ...patch } : draft)));
    setNotice(null);
  }

  return (
    <dialog className="settings-dialog" aria-labelledby="settings-title" onClose={onClose} ref={dialog}>
      <div className="settings-head">
        <h2 id="settings-title">{localized(COPY.settingsTitle, locale)}</h2>
        <button aria-label={localized(COPY.settingsClose, locale)} className="work-action" onClick={() => dialog.current?.close()} type="button">×</button>
      </div>

      {!token ? (
        <form className="settings-login" onSubmit={handleLogin}>
          <label htmlFor="settings-password">{localized(COPY.passwordLabel, locale)}</label>
          <input
            autoComplete="current-password"
            id="settings-password"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
          <button className="work-action" data-forward="true" disabled={!password || busy} type="submit">
            {localized(COPY.login, locale)}
          </button>
        </form>
      ) : config ? (
        <form className="settings-form" onSubmit={handleSave}>
          <p className="settings-intro">{localized(COPY.settingsIntro, locale)}</p>
          {config.auto ? <p className="settings-intro">{localized(COPY.autoNote, locale)}</p> : null}
          {config.guilds.length === 0 ? <p className="settings-intro">{localized(COPY.noGuilds, locale)}</p> : null}
          <div className="settings-slots">
            {drafts.map((draft, index) => {
              const zone = ROOM_ZONES[index];
              const guild = config.guilds.find(({ id }) => id === draft.guildId);
              const needsGuild = draft.kind === "guild" || draft.kind === "channel";
              const fieldId = `slot-${index}`;
              return (
                <fieldset key={zone.id}>
                  <legend>{zone.code} · {localized(zone.name, locale)}</legend>
                  <label htmlFor={`${fieldId}-kind`}>{localized(COPY.slotKind, locale)}</label>
                  <select
                    id={`${fieldId}-kind`}
                    onChange={(event) => change(index, { kind: event.target.value as RoomKind })}
                    value={draft.kind}
                  >
                    {KINDS.map(({ kind, label }) => <option key={kind} value={kind}>{localized(label, locale)}</option>)}
                  </select>
                  {needsGuild ? (
                    <>
                      <label htmlFor={`${fieldId}-guild`}>{localized(COPY.slotServer, locale)}</label>
                      <select
                        id={`${fieldId}-guild`}
                        onChange={(event) => change(index, { guildId: event.target.value, channelId: "" })}
                        value={draft.guildId}
                      >
                        <option value="">{localized(COPY.choose, locale)}</option>
                        {/* A saved server the bot has since left stays selectable, so opening the panel does not silently drop it. */}
                        {draft.guildId && !guild ? <option value={draft.guildId}>{localized(COPY.roomMissing, locale)}</option> : null}
                        {config.guilds.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                      </select>
                    </>
                  ) : null}
                  {draft.kind === "channel" ? (
                    <>
                      <label htmlFor={`${fieldId}-channel`}>{localized(COPY.slotChannel, locale)}</label>
                      <select
                        disabled={!draft.guildId}
                        id={`${fieldId}-channel`}
                        onChange={(event) => change(index, { channelId: event.target.value })}
                        value={draft.channelId}
                      >
                        <option value="">{localized(COPY.choose, locale)}</option>
                        {draft.channelId && !guild?.channels.some(({ id }) => id === draft.channelId)
                          ? <option value={draft.channelId}>{localized(COPY.roomMissing, locale)}</option>
                          : null}
                        {(["voice", "text"] as const).map((type) => {
                          const channels = guild?.channels.filter((channel) => channel.type === type) ?? [];
                          if (!channels.length) return null;
                          return (
                            <optgroup key={type} label={localized(type === "voice" ? COPY.channelVoice : COPY.channelText, locale)}>
                              {channels.map(({ id, name }) => <option key={id} value={id}>{type === "text" ? `#${name}` : name}</option>)}
                            </optgroup>
                          );
                        })}
                      </select>
                    </>
                  ) : null}
                  {draft.kind !== "none" ? (
                    <>
                      <label htmlFor={`${fieldId}-label`}>{localized(COPY.slotLabel, locale)}</label>
                      <input
                        autoComplete="off"
                        id={`${fieldId}-label`}
                        maxLength={SLOT_LABEL_MAX}
                        onChange={(event) => change(index, { label: event.target.value })}
                        type="text"
                        value={draft.label}
                      />
                    </>
                  ) : null}
                </fieldset>
              );
            })}
          </div>
          <div className="settings-actions">
            <button className="work-action" disabled={busy || config.auto} onClick={() => void send({ auto: true })} type="button">
              {localized(COPY.resetAuto, locale)}
            </button>
            <button className="work-action" data-forward="true" disabled={busy} type="submit">
              {localized(busy ? COPY.saving : COPY.save, locale)}
            </button>
          </div>
        </form>
      ) : null}

      <p className="settings-notice" data-bad={notice?.bad ? "true" : "false"} role="status">
        {notice ? localized(notice.text, locale) : ""}
      </p>
    </dialog>
  );
}
