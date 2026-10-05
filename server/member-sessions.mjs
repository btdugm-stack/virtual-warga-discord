/**
 * How the site learns which Discord member a visitor is, so they can build their own character there and
 * nobody else's. Two ways in, both ending in the same session cookie:
 *
 * - A personal link. `/karakter` in Discord hands the member a link carrying a one-time ticket.
 * - "Masuk dengan Discord" (OAuth2, scope `identify`), available when DISCORD_CLIENT_ID and
 *   DISCORD_CLIENT_SECRET are set. Discord tells us the account's id and nothing is kept of the access token.
 *
 * Sessions live in memory: a restart signs everyone out, and they get a new link or sign in again.
 */
import crypto from "node:crypto";

const TICKET_MS = 10 * 60 * 1000;
const SESSION_MS = 12 * 60 * 60 * 1000;
const STATE_MS = 10 * 60 * 1000;
const COOKIE = "warga_session";
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const DISCORD_API = "https://discord.com/api";

const newToken = () => crypto.randomBytes(32).toString("hex");

/** A map whose entries stop counting after their time is up. */
class Expiring {
  constructor(ms) {
    this.ms = ms;
    this.entries = new Map();
  }

  put(key, value) {
    const now = Date.now();
    for (const [old, entry] of this.entries) if (now >= entry.until) this.entries.delete(old);
    this.entries.set(key, { value, until: now + this.ms });
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.until) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /** Read and remove: for things that may be used once. */
  take(key) {
    const value = this.get(key);
    this.entries.delete(key);
    return value;
  }
}

export class MemberSessions {
  constructor({ publicUrl, clientId = "", clientSecret = "" }) {
    this.publicUrl = publicUrl.replace(/\/+$/, "");
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.tickets = new Expiring(TICKET_MS);
    this.sessions = new Expiring(SESSION_MS);
    this.states = new Expiring(STATE_MS);
  }

  get oauth() {
    return Boolean(this.clientId && this.clientSecret);
  }

  get redirectUri() {
    return `${this.publicUrl}/api/auth/discord/callback`;
  }

  /** The address the site's character builder opens at. */
  get builderUrl() {
    return `${this.publicUrl}/?karakter`;
  }

  /** A link that signs this member in once, for the next ten minutes. Only ever shown to that member. */
  ticketUrl(userId) {
    const ticket = newToken();
    this.tickets.put(ticket, userId);
    return `${this.builderUrl}=${ticket}`;
  }

  /** Trade a ticket for a session. Returns the session token, or null when the ticket is spent, old, or made up. */
  redeem(ticket) {
    if (typeof ticket !== "string" || !TOKEN_PATTERN.test(ticket)) return null;
    const userId = this.tickets.take(ticket);
    return userId ? this.open(userId) : null;
  }

  /** Where to send someone to sign in with Discord. `state` ties the answer back to this request. */
  authorizeUrl() {
    const state = newToken();
    this.states.put(state, true);
    const query = new URLSearchParams({
      client_id: this.clientId,
      response_type: "code",
      redirect_uri: this.redirectUri,
      scope: "identify",
      state,
      prompt: "none",
    });
    return `${DISCORD_API}/oauth2/authorize?${query}`;
  }

  /** Finish signing in with Discord. Returns the session token, or null when Discord's answer does not check out. */
  async finish(code, state) {
    if (typeof code !== "string" || typeof state !== "string" || !this.states.take(state)) return null;
    const exchanged = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: this.redirectUri,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!exchanged.ok) return null;
    const { access_token: accessToken } = await exchanged.json();
    const me = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!me.ok) return null;
    const { id } = await me.json();
    return typeof id === "string" && /^\d{5,25}$/.test(id) ? this.open(id) : null;
  }

  /** The Discord user id behind a request's session cookie, or null. */
  userOf(req) {
    const token = this.#tokenOf(req);
    return token ? this.sessions.get(token) ?? null : null;
  }

  close(req) {
    const token = this.#tokenOf(req);
    if (token) this.sessions.take(token);
  }

  /**
   * The Set-Cookie value that carries a session. HttpOnly keeps page scripts from reading it; SameSite=Lax
   * keeps other sites from using it for anything but opening the site.
   */
  cookie(token) {
    const seconds = token ? Math.floor(SESSION_MS / 1000) : 0;
    const secure = this.publicUrl.startsWith("https://") ? "; Secure" : "";
    return `${COOKIE}=${token ?? ""}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure}`;
  }

  /** Start a session for a member whose identity is already established. Returns the session token. */
  open(userId) {
    const token = newToken();
    this.sessions.put(token, userId);
    return token;
  }

  #tokenOf(req) {
    for (const part of (req.headers.cookie ?? "").split(";")) {
      const [name, value] = part.trim().split("=");
      if (name === COOKIE && TOKEN_PATTERN.test(value ?? "")) return value;
    }
    return null;
  }
}
