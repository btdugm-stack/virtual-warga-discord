/**
 * Member sessions (`server/member-sessions.mjs`): a personal link works once and then dies, sessions and
 * tickets have a lifetime, the cookie carries the right flags for an HttpOnly API-scoped session, and the
 * Discord code/state exchange only trades a genuine, un-reused state for a session.
 */
import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { MemberSessions } from "../member-sessions.mjs";

const TICKET_MS = 10 * 60 * 1000;
const USER_ID = "1111111111111111111";

const ticketOf = (url) => url.slice(url.indexOf("=") + 1);
const requestWith = (cookie) => ({ headers: { cookie } });

afterEach(() => mock.timers.reset());

test("a ticket is single-use", () => {
  const sessions = new MemberSessions({ publicUrl: "https://warga.example" });
  const url = sessions.ticketUrl(USER_ID);
  const ticket = ticketOf(url);

  assert.match(ticket, /^[a-f0-9]{64}$/);
  const token = sessions.redeem(ticket);
  assert.match(token, /^[a-f0-9]{64}$/, "redeeming a ticket opens a session");
  assert.equal(sessions.userOf(requestWith(`warga_session=${token}`)), USER_ID);
  assert.equal(sessions.redeem(ticket), null, "the second use finds nothing");
});

test("redeeming something made up, malformed, or already spent returns null", () => {
  const sessions = new MemberSessions({ publicUrl: "https://warga.example" });
  assert.equal(sessions.redeem("not-at-ticket"), null);
  assert.equal(sessions.redeem("ab".repeat(32)), null);

  const spent = ticketOf(sessions.ticketUrl(USER_ID));
  sessions.redeem(spent);
  assert.equal(sessions.redeem(spent), null);
});

test("a ticket expires after ten minutes", () => {
  mock.timers.enable({ apis: ["Date"] });
  const sessions = new MemberSessions({ publicUrl: "https://warga.example" });

  const url = sessions.ticketUrl(USER_ID);
  assert.ok(sessions.redeem(ticketOf(url)));
  const second = sessions.ticketUrl("2222222222222222222");

  mock.timers.tick(TICKET_MS + 1);
  assert.equal(sessions.redeem(ticketOf(second)), null, "the second ticket is spent by time");
});

test("the session cookie is HttpOnly, scoped to /api, SameSite=Lax, and Secure on https", () => {
  const sessions = new MemberSessions({ publicUrl: "https://warga.example" });
  const cookie = sessions.cookie("ab".repeat(32));

  assert.match(cookie, /^\w+=[a-f0-9]{64}; Path=\/api; HttpOnly; SameSite=Lax; Max-Age=\d+; Secure$/);
});

test("a clear cookie drops the session while keeping the other flags, and plain http never sets Secure", () => {
  const sessions = new MemberSessions({ publicUrl: "http://localhost:8787" });
  const cleared = sessions.cookie(null);
  assert.match(cleared, /Max-Age=0/, "a cleared session cookie expires immediately");
  assert.match(cleared, /Path=\/api; HttpOnly; SameSite=Lax/);
  assert.equal(cleared.includes("Secure"), false);
});

test("userOf reads the session cookie and ignores anything malformed", () => {
  const sessions = new MemberSessions({ publicUrl: "https://warga.example" });
  const token = sessions.open(USER_ID);

  assert.equal(sessions.userOf(requestWith(`warga_session=${token}; something=else`)), USER_ID);
  assert.equal(sessions.userOf(requestWith("warga_session=short")), null);
  assert.equal(sessions.userOf({ headers: {} }), null);
});

test("close ends the session", () => {
  const sessions = new MemberSessions({ publicUrl: "https://warga.example" });
  const token = sessions.open(USER_ID);
  const req = requestWith(`warga_session=${token}`);

  sessions.close(req);
  assert.equal(sessions.userOf(req), null);
});

test("Discord sign-in is only possible when client id and secret are set", () => {
  assert.equal(new MemberSessions({ publicUrl: "https://warga.example" }).oauth, false);
  assert.equal(new MemberSessions({ publicUrl: "https://warga.example", clientId: "x" }).oauth, false);
  assert.equal(new MemberSessions({ publicUrl: "https://warga.example", clientId: "x", clientSecret: "y" }).oauth, true);
});

test("the Discord exchange keeps no more than the account id", async () => {
  const sessions = new MemberSessions({ publicUrl: "https://warga.example", clientId: "cid", clientSecret: "sec" });
  const authorizeUrl = sessions.authorizeUrl();
  const query = new URL(authorizeUrl).searchParams;
  assert.equal(query.get("scope"), "identify");
  assert.ok(query.get("state"));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("/oauth2/token")) return { ok: true, json: async () => ({ access_token: "at" }) };
    if (String(url).endsWith("/users/@me")) return { ok: true, json: async () => ({ id: USER_ID }) };
    throw new Error(`unexpected fetch: ${url}`);
  };

  try {
    const token = await sessions.finish("code-would-be-here", query.get("state"));
    assert.ok(token);
    assert.equal(sessions.userOf(requestWith(`warga_session=${token}`)), USER_ID);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a refused or replayed state never opens a session", async () => {
  const sessions = new MemberSessions({ publicUrl: "https://warga.example", clientId: "cid", clientSecret: "sec" });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("/oauth2/token")) return { ok: true, json: async () => ({ access_token: "at" }) };
    if (String(url).endsWith("/users/@me")) return { ok: true, json: async () => ({ id: USER_ID }) };
    throw new Error(`unexpected fetch: ${url}`);
  };

  try {
    assert.equal(await sessions.finish("code", "made-up-state"), null);
    const second = new URL(sessions.authorizeUrl()).searchParams.get("state");
    assert.ok(await sessions.finish("code", second));
    assert.equal(await sessions.finish("code", second), null, "the same state works only once");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a failed token exchange closes with no session", async () => {
  const sessions = new MemberSessions({ publicUrl: "https://warga.example", clientId: "cid", clientSecret: "sec" });
  const state = new URL(sessions.authorizeUrl()).searchParams.get("state");

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false });

  try {
    assert.equal(await sessions.finish("code", state), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});