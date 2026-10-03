/**
 * The one process behind the office: holds the bot connection, pushes the public snapshot to browsers over
 * Server-Sent Events, serves the admin API for room bindings, and serves the built site from `dist/`.
 *
 * The bot token and the admin password live only here (environment variables). The browser never sees either.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ConfigStore, checkedSlots } from "./config-store.mjs";
import { startDemo } from "./demo-source.mjs";
import { World } from "./world.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, "dist");
const PORT = Number(process.env.PORT) || 8787;
const TOKEN = process.env.DISCORD_TOKEN?.trim() ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const CONFIG_FILE = process.env.CONFIG_FILE || path.join(ROOT, "server", "data", "rooms.json");

const BODY_MAX = 16 * 1024;
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
function publicId(userId) {
  let id = publicIds.get(userId);
  if (!id) {
    id = crypto.createHmac("sha256", idKey).update(userId).digest("base64url").slice(0, 16);
    publicIds.set(userId, id);
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

function payload() {
  const slots = config.slots(world);
  world.setRelevant(slots);
  return JSON.stringify(world.snapshot(slots, publicId));
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

function readJson(req) {
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
      if (size > BODY_MAX) {
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
  startDiscord(world, TOKEN);
} else {
  console.warn("[server] DISCORD_TOKEN belum diisi — berjalan dalam mode demo dengan data karangan.");
  startDemo(world);
}
if (!ADMIN_PASSWORD) console.warn("[server] ADMIN_PASSWORD belum diisi — panel pengaturan ruangan dinonaktifkan.");

server.listen(PORT, () => console.log(`[server] http://localhost:${PORT}`));
