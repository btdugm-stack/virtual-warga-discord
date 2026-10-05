/**
 * The one process behind the office: holds the bot connection, pushes the public snapshot to browsers over
 * Server-Sent Events, serves the admin API for room bindings and the furniture layout, passes members'
 * profile pictures through without revealing their Discord ids, and serves the built site from `dist/`.
 *
 * The bot token and the admin password live only here (environment variables). The browser never sees either.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkedSpec, codeOf, kitDescription, sheetPng, smoothSpec } from "./character-kit.mjs";
import { CharacterStore } from "./character-store.mjs";
import { ConfigStore, checkedSlots } from "./config-store.mjs";
import { startDemo } from "./demo-source.mjs";
import { LayoutStore, checkedLayout } from "./layout-store.mjs";
import { startLevels } from "./levels-source.mjs";
import { MemberSessions } from "./member-sessions.mjs";
import { World } from "./world.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, "dist");
const PORT = Number(process.env.PORT) || 8787;
const TOKEN = process.env.DISCORD_TOKEN?.trim() ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
/** Where visitors reach this site. Personal links from Discord and the Discord sign-in both lead back here. */
const PUBLIC_URL = process.env.PUBLIC_URL?.trim() || `http://localhost:${PORT}`;
const members = new MemberSessions({
  publicUrl: PUBLIC_URL,
  clientId: process.env.DISCORD_CLIENT_ID?.trim(),
  clientSecret: process.env.DISCORD_CLIENT_SECRET?.trim(),
});
const CONFIG_FILE = process.env.CONFIG_FILE || path.join(ROOT, "server", "data", "rooms.json");

const BODY_MAX = 16 * 1024;
/** A full layout is 240 pieces of furniture, more than the default body limit allows. */
const LAYOUT_BODY_MAX = 64 * 1024;
const STREAM_MAX = 500;
const SESSION_MS = 12 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX = 8;
/** Changes are batched: one gateway burst (a server coming online) becomes one push, not hundreds. */
const PUSH_DELAY_MS = 300;
const SWEEP_MS = 5000;
const HEARTBEAT_MS = 25_000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
};

/**
 * Discord user ids are not published. Each browser-visible id is a keyed hash, and the key is new on every
 * start, so the ids cannot be matched back to accounts or across restarts.
 */
const idKey = crypto.randomBytes(32);
const publicIds = new Map();
const userIds = new Map();
function publicId(userId) {
  let id = publicIds.get(userId);
  if (!id) {
    id = crypto.createHmac("sha256", idKey).update(userId).digest("base64url").slice(0, 16);
    publicIds.set(userId, id);
    userIds.set(id, userId);
  }
  return id;
}

const streams = new Set();
let pushTimer = null;
let lastPayload = "";

const world = new World(() => {
  pushTimer ??= setTimeout(push, PUSH_DELAY_MS);
});
const config = new ConfigStore(CONFIG_FILE);
const layouts = new LayoutStore(path.join(path.dirname(CONFIG_FILE), "layout.json"));
const characters = new CharacterStore(path.join(path.dirname(CONFIG_FILE), "characters.json"));
/** Set once the Discord connection starts. Demo members have no profile pictures. */
let avatarUrl = () => null;

/** The profile picture this member wears, or null: they have none, or have not turned it on in the `/karakter` picker. */
function wornAvatar(userId) {
  return characters.look(userId).photo ? avatarUrl(userId) : null;
}

/**
 * How a member looks, as sent to browsers. `look` is the code of their character; its sprite sheet is at
 * `/api/character/<look>.png`. `avatar` is not the picture's address (that contains the Discord id) but a
 * short tag that changes with the picture; the browser asks `/api/avatar/<public id>` for the image itself.
 */
function profileOf(userId) {
  const url = wornAvatar(userId);
  const { spec, activity } = characters.look(userId);
  return {
    look: codeOf(spec),
    // A sheet drawn finer than the office's grid is scaled down, so it must not be drawn pixelated.
    ...(smoothSpec(spec) ? { smooth: true } : {}),
    // Not sent on: tells the snapshot whether this member lets their game or music be shown.
    // Demo members are invented, so there is nobody to ask.
    sharesActivity: activity || world.demo,
    avatar: url ? crypto.createHash("sha256").update(url).digest("base64url").slice(0, 8) : null,
  };
}

const AVATAR_CACHE_MAX = 500;
const AVATAR_BYTES_MAX = 256 * 1024;
/** Fetched pictures by address, oldest first. A changed picture has a new address, so entries never go stale. */
const avatarCache = new Map();

function avatarImage(url) {
  let image = avatarCache.get(url);
  if (!image) {
    image = (async () => {
      // The address comes from discord.js, but only Discord's CDN is ever fetched from here.
      if (new URL(url).hostname !== "cdn.discordapp.com") throw new Error("Unexpected avatar host");
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`Avatar fetch failed: ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > AVATAR_BYTES_MAX) throw new Error("Avatar too large");
      return bytes;
    })();
    avatarCache.set(url, image);
    image.catch(() => avatarCache.delete(url));
    if (avatarCache.size > AVATAR_CACHE_MAX) avatarCache.delete(avatarCache.keys().next().value);
  }
  return image;
}

function payload() {
  const slots = config.slots(world);
  world.setRelevant(slots);
  return JSON.stringify({ ...world.snapshot(slots, publicId, profileOf), layoutRev: layouts.rev });
}

function push() {
  pushTimer = null;
  const next = payload();
  if (next === lastPayload) return;
  lastPayload = next;
  for (const stream of streams) stream.write(`event: snapshot\ndata: ${next}\n\n`);
}

setInterval(() => {
  world.sweep();
  push();
}, SWEEP_MS);
setInterval(() => {
  for (const stream of streams) stream.write(": ping\n\n");
}, HEARTBEAT_MS);

/* ---------- admin sessions ---------- */

const sessions = new Map();
const loginAttempts = new Map();

function passwordMatches(input) {
  if (!ADMIN_PASSWORD || typeof input !== "string") return false;
  // Compare digests so the comparison takes the same time whatever the input length.
  const a = crypto.createHash("sha256").update(input).digest();
  const b = crypto.createHash("sha256").update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

function loginAllowed(ip, now) {
  const entry = loginAttempts.get(ip);
  if (!entry || now >= entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= LOGIN_MAX;
}

function isAdmin(req) {
  const token = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization ?? "")?.[1];
  const expires = token ? sessions.get(token) : undefined;
  if (!expires) return false;
  if (Date.now() >= expires) {
    sessions.delete(token);
    return false;
  }
  return true;
}

/* ---------- http ---------- */

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function readJson(req, max = BODY_MAX) {
  return new Promise((resolve, reject) => {
    // Requiring JSON keeps a plain cross-site form from reaching the admin routes.
    if (!/^application\/json\b/i.test(req.headers["content-type"] ?? "")) {
      reject(new Error("Expected JSON"));
      return;
    }
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > max) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function adminConfig() {
  return { auto: config.auto, slots: config.slots(world), guilds: world.catalog() };
}

async function handleApi(req, res, route) {
  if (route === "/api/state" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(payload());
    return;
  }

  if (route === "/api/events" && req.method === "GET") {
    if (streams.size >= STREAM_MAX) {
      sendJson(res, 503, { error: "busy" });
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      // Tell nginx-style proxies not to hold the stream back.
      "X-Accel-Buffering": "no",
    });
    res.write(`retry: 3000\nevent: snapshot\ndata: ${payload()}\n\n`);
    streams.add(res);
    req.on("close", () => streams.delete(res));
    return;
  }

  const lookCode = /^\/api\/character\/([0-9a-z_-]{1,64})\.png$/.exec(route)?.[1];
  if (lookCode && req.method === "GET") {
    const sheet = sheetPng(lookCode);
    if (!sheet) {
      sendJson(res, 404, { error: "not_found" });
      return;
    }
    // A code spells one character and, for a ready-made one, which version of its art, so this never changes.
    res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" });
    res.end(sheet);
    return;
  }

  const avatarOf = /^\/api\/avatar\/([A-Za-z0-9_-]{16})$/.exec(route)?.[1];
  if (avatarOf && req.method === "GET") {
    const userId = userIds.get(avatarOf);
    const url = userId ? wornAvatar(userId) : null;
    if (!url) {
      sendJson(res, 404, { error: "not_found" });
      return;
    }
    let image;
    try {
      image = await avatarImage(url);
    } catch {
      sendJson(res, 502, { error: "avatar_unavailable" });
      return;
    }
    // The browser's request carries the picture's tag, so a new picture is a new address and this can be cached.
    res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" });
    res.end(image);
    return;
  }

  if (route === "/api/kit" && req.method === "GET") {
    sendJson(res, 200, { ...kitDescription(), oauth: members.oauth });
    return;
  }

  if (route === "/api/auth/discord" && req.method === "GET") {
    if (!members.oauth) {
      sendJson(res, 503, { error: "oauth_disabled" });
      return;
    }
    res.writeHead(302, { Location: members.authorizeUrl(), "Cache-Control": "no-store" }).end();
    return;
  }

  if (route === "/api/auth/discord/callback" && req.method === "GET") {
    const query = new URL(req.url ?? "/", "http://localhost").searchParams;
    // A refusal on Discord's side (the visitor pressed Cancel) comes back here too, without a code.
    const token = members.oauth ? await members.finish(query.get("code"), query.get("state")).catch(() => null) : null;
    res.writeHead(302, {
      Location: token ? members.builderUrl : `${members.builderUrl}=gagal`,
      "Cache-Control": "no-store",
      ...(token ? { "Set-Cookie": members.cookie(token) } : {}),
    }).end();
    return;
  }

  if (route === "/api/me/session" && req.method === "POST") {
    const body = await readJson(req);
    // Demo members are invented, so the demo lets anyone try the builder as the first of them.
    const demoUser = world.demo && body?.ticket === "demo" ? world.users.keys().next().value : null;
    const token = demoUser ? members.open(demoUser) : members.redeem(body?.ticket);
    if (!token) {
      sendJson(res, 401, { error: "ticket_invalid" });
      return;
    }
    res.setHeader("Set-Cookie", members.cookie(token));
    sendJson(res, 200, { ok: true });
    return;
  }

  if (route === "/api/me/logout" && req.method === "POST") {
    members.close(req);
    res.setHeader("Set-Cookie", members.cookie(null));
    sendJson(res, 200, { ok: true });
    return;
  }

  if (route === "/api/me" || route === "/api/me/character") {
    const userId = members.userOf(req);
    if (!userId) {
      sendJson(res, 401, { error: "signed_out" });
      return;
    }
    // Signed in with Discord, but not someone any shown server has: there is no character to build.
    const user = world.users.get(userId);
    if (!user) {
      sendJson(res, 403, { error: "not_a_member" });
      return;
    }
    if (route === "/api/me/character" && req.method === "PUT") {
      const body = await readJson(req);
      const spec = body?.spec === null ? null : checkedSpec(body?.spec);
      if (spec === null && body?.spec !== null) throw new Error("Invalid character");
      // Like the picker in Discord: the automatic look is stored as "nothing chosen".
      const automatic = spec !== null && codeOf(spec) === codeOf(characters.automatic(userId));
      characters.update(userId, { spec: automatic ? null : spec, photo: body?.photo === true, activity: body?.activity === true });
      world.touch();
    } else if (req.method !== "GET") {
      sendJson(res, 404, { error: "not_found" });
      return;
    }
    sendJson(res, 200, { name: user.name, ...characters.look(userId), automatic: characters.automatic(userId) });
    return;
  }

  if (route === "/api/layout" && req.method === "GET") {
    sendJson(res, 200, { layout: layouts.layout });
    return;
  }

  if (route === "/api/admin/layout" && req.method === "PUT") {
    if (!isAdmin(req)) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const body = await readJson(req, LAYOUT_BODY_MAX);
    layouts.save(checkedLayout(body?.layout));
    push();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (route === "/api/admin/login" && req.method === "POST") {
    if (!ADMIN_PASSWORD) {
      sendJson(res, 503, { error: "admin_disabled" });
      return;
    }
    const now = Date.now();
    if (!loginAllowed(req.socket.remoteAddress ?? "", now)) {
      sendJson(res, 429, { error: "too_many_attempts" });
      return;
    }
    const body = await readJson(req);
    if (!passwordMatches(body?.password)) {
      sendJson(res, 401, { error: "wrong_password" });
      return;
    }
    for (const [token, expires] of sessions) if (now >= expires) sessions.delete(token);
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, now + SESSION_MS);
    sendJson(res, 200, { token });
    return;
  }

  if (route === "/api/admin/config") {
    if (!isAdmin(req)) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    if (req.method === "GET") {
      sendJson(res, 200, adminConfig());
      return;
    }
    if (req.method === "PUT") {
      const body = await readJson(req);
      if (body?.auto === true) config.reset();
      else config.save(checkedSlots(body?.slots));
      push();
      sendJson(res, 200, adminConfig());
      return;
    }
  }

  sendJson(res, 404, { error: "not_found" });
}

function serveStatic(req, res, route) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405).end();
    return;
  }
  let file = path.join(DIST, path.normalize(decodeURIComponent(route)));
  // `normalize` resolves `..`; anything that still lands outside dist is refused.
  if (file !== DIST && !file.startsWith(DIST + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
  if (!fs.existsSync(file)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Situs belum dibangun. Jalankan `npm run build`, atau buka server Vite saat pengembangan.");
    return;
  }
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream",
    // Vite's hashed bundles never change; everything else is revalidated.
    "Cache-Control": route.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
  if (req.method === "HEAD") res.end();
  else fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  let route;
  try {
    route = new URL(req.url ?? "/", "http://localhost").pathname;
    decodeURIComponent(route);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (!route.startsWith("/api/")) {
    serveStatic(req, res, route);
    return;
  }
  handleApi(req, res, route).catch((error) => {
    if (!res.headersSent) sendJson(res, 400, { error: "bad_request", detail: error.message });
    else res.end();
  });
});

if (TOKEN) {
  const { startDiscord } = await import("./discord-source.mjs");
  ({ avatarUrl } = startDiscord(world, TOKEN, characters, (userId) => members.ticketUrl(userId)));
  if (process.env.MEE6_LEVELS?.trim().toLowerCase() !== "off") startLevels(world);
} else {
  console.warn("[server] DISCORD_TOKEN belum diisi — berjalan dalam mode demo dengan data karangan.");
  startDemo(world);
}
if (!ADMIN_PASSWORD) console.warn("[server] ADMIN_PASSWORD belum diisi — panel pengaturan ruangan dinonaktifkan.");

server.listen(PORT, () => console.log(`[server] http://localhost:${PORT}`));
