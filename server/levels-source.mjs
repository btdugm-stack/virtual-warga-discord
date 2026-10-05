/**
 * Member levels, read from MEE6's leaderboard for each server the office shows.
 *
 * This is MEE6's own web address for a server's public leaderboard, not a documented API: it only answers
 * while that server's leaderboard is public, and MEE6 may change or limit it at any time. So nothing else
 * depends on it. When it fails, the levels already known are kept and the office simply shows no new ones.
 * Set MEE6_LEVELS=off to never call it.
 */

const LEADERBOARD = "https://mee6.xyz/api/plugins/levels/leaderboard";
/** Levels move slowly; this is also gentle on a service that owes us nothing. */
const REFRESH_MS = 10 * 60 * 1000;
const PAGE_SIZE = 1000;
/** The office seats a few hundred people at most; ranks beyond this are never on screen. */
const PAGES_MAX = 3;

async function leaderboard(guildId) {
  const levels = new Map();
  for (let page = 0; page < PAGES_MAX; page += 1) {
    const response = await fetch(`${LEADERBOARD}/${guildId}?limit=${PAGE_SIZE}&page=${page}`, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`MEE6 menjawab ${response.status}`);
    const { players } = await response.json();
    if (!Array.isArray(players)) throw new Error("jawaban MEE6 tidak dikenali");
    for (const player of players) {
      if (typeof player?.id === "string" && Number.isInteger(player.level) && player.level >= 0) levels.set(player.id, player.level);
    }
    if (players.length < PAGE_SIZE) break;
  }
  return levels;
}

/** Keeps `world`'s levels fresh for the servers its rooms are bound to. */
export function startLevels(world) {
  /** Servers whose last attempt failed, so the same problem is logged once, not every ten minutes. */
  const failing = new Set();

  const refresh = async () => {
    for (const guildId of world.relevant) {
      try {
        world.setLevels(guildId, await leaderboard(guildId));
        if (failing.delete(guildId)) console.log("[level] papan peringkat MEE6 terbaca lagi.");
      } catch (error) {
        if (!failing.has(guildId)) {
          console.warn(`[level] papan peringkat MEE6 tidak terbaca (${error.message}). Level tidak ditampilkan sampai terbaca lagi; pastikan leaderboard MEE6 server itu publik.`);
        }
        failing.add(guildId);
      }
    }
  };

  // The rooms' bindings are known a moment after start, once the first snapshot is built.
  setTimeout(refresh, 15_000).unref();
  setInterval(refresh, REFRESH_MS).unref();
}
