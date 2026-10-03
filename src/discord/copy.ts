import { localized, type Locale, type LocalizedText } from "../i18n";
import type { FeedKind, Presence } from "./types";

/**
 * Copy for everything Discord-related. The office editor's copy stays in `i18n.ts`.
 *
 * This copy is written in Indonesian and English. Korean, Chinese, and Vietnamese show the English text
 * until someone translates them: replace `both(...)` with a full five-language object to do so.
 */
function both(id: string, en: string): LocalizedText {
  return { id, en, ko: en, zh: en, vi: en };
}

export const COPY = {
  language: { ko: "언어", en: "Language", zh: "语言", vi: "Ngôn ngữ", id: "Bahasa" },
  clock: { ko: "현재 시각", en: "Local time", zh: "本地时间", vi: "Giờ địa phương", id: "Waktu setempat" },

  linkConnecting: both("Menghubungkan…", "Connecting…"),
  linkLive: both("Tersambung langsung", "Live"),
  linkDemo: both("Mode demo", "Demo mode"),
  warnLost: both(
    "Sambungan ke server terputus. Mencoba lagi; tampilan di bawah adalah keadaan terakhir.",
    "The connection to the server dropped. Retrying; what you see is the last known state.",
  ),
  warnDemo: both(
    "Mode demo: server belum punya token bot, jadi semua warga di sini karangan.",
    "Demo mode: the server has no bot token, so everyone here is made up.",
  ),
  warnBotConnecting: both("Bot sedang menyambung ke Discord…", "The bot is connecting to Discord…"),
  warnToken: both(
    "Bot gagal masuk ke Discord: token ditolak. Periksa DISCORD_TOKEN di server.",
    "The bot could not log in to Discord: the token was rejected. Check DISCORD_TOKEN on the server.",
  ),
  warnIntents: both(
    "Bot gagal masuk ke Discord: Presence Intent dan Server Members Intent belum diaktifkan di Developer Portal.",
    "The bot could not log in to Discord: enable the Presence and Server Members intents in the Developer Portal.",
  ),
  warnUnknown: both(
    "Bot gagal masuk ke Discord. Lihat log server untuk penyebabnya.",
    "The bot could not log in to Discord. See the server log for the cause.",
  ),
  warnNoRooms: both(
    "Belum ada ruangan yang terhubung. Buka Pengaturan ruangan untuk memilih server atau channel.",
    "No room is bound yet. Open Room settings to pick a server or channel.",
  ),

  officeKicker: both("LANTAI WARGA DISCORD", "DISCORD FLOOR"),
  officeTitle: both("Satu kantor, semua server", "One office, every server"),
  officeSummary: both(
    "{count} warga terlihat · {voice} di voice · {chat} lagi gibah",
    "{count} members shown · {voice} in voice · {chat} chatting",
  ),
  badgeLive: both("Ramai", "Lively"),
  badgeQuiet: both("Sepi", "Quiet"),

  stripLabel: both("Ruangan", "Rooms"),
  roomEmpty: both("Belum dihubungkan", "Not bound"),
  roomMissing: both("Tidak ditemukan", "Not found"),
  roomIdle: both("Ruang AFK", "AFK room"),
  roomCount: both("{count} warga", "{count} members"),
  roomOverflow: both("+{count} lagi", "+{count} more"),

  tabOffice: both("Kantor", "Office"),
  tabFeed: both("Rasan-rasan", "Activity"),
  tabRoster: both("Warga", "Members"),
  paneTabs: both("Tampilan", "View"),

  feedTitle: both("Aktivitas Rasan-rasan", "Activity"),
  feedEmpty: both(
    "Belum ada aktivitas. Begitu ada yang online, masuk voice, atau chat, catatannya muncul di sini.",
    "Nothing yet. When someone comes online, joins voice, or chats, it shows up here.",
  ),
  rosterTitle: both("Siapa di mana", "Who is where"),
  rosterEmpty: both("Belum ada warga yang terlihat.", "Nobody is here yet."),

  agentRoom: both("Ruang", "Room"),
  agentNow: both("Sekarang", "Now"),
  agentSummary: both("{name}, {presence}, {room}, {activity}", "{name}, {presence}, {room}, {activity}"),
  activityChat: both("Sedang Gibah di #{where}", "Chatting in #{where}"),
  activityVoice: both("Di voice {where}", "In voice {where}"),
  activityIdle: both("Lagi bengong", "Away"),
  activityOffline: both("Offline", "Offline"),
  activityNone: both("Nongkrong", "Hanging out"),
  voiceBadge: both("VC · {where}", "VC · {where}"),

  settingsOpen: both("Pengaturan ruangan", "Room settings"),
  settingsTitle: both("Pengaturan ruangan", "Room settings"),
  settingsClose: both("Tutup pengaturan", "Close settings"),
  settingsIntro: both(
    "Tiap ruangan bisa menampilkan satu server, satu channel, atau warga yang idle dan offline (Ruang AFK). Satu warga hanya muncul di satu ruangan: voice channel dulu, lalu channel tempat ia terakhir chat, lalu Ruang AFK, lalu servernya. Warga offline hanya terlihat jika ada Ruang AFK.",
    "Each room can show one server, one channel, or idle and offline members (the AFK room). A member appears in one room only: their voice channel first, then the channel they last chatted in, then the AFK room, then their server. Offline members are shown only when there is an AFK room.",
  ),
  passwordLabel: both("Kata sandi admin", "Admin password"),
  login: both("Masuk", "Sign in"),
  loginWrong: both("Kata sandi salah.", "Wrong password."),
  loginLimited: both("Terlalu banyak percobaan. Coba lagi dalam 10 menit.", "Too many attempts. Try again in 10 minutes."),
  loginDisabled: both(
    "Pengaturan dinonaktifkan: ADMIN_PASSWORD belum diisi di server.",
    "Settings are disabled: ADMIN_PASSWORD is not set on the server.",
  ),
  requestFailed: both("Server tidak bisa dihubungi. Coba lagi.", "The server could not be reached. Try again."),
  sessionExpired: both("Sesi admin berakhir. Masuk lagi.", "The admin session ended. Sign in again."),
  autoNote: both(
    "Belum ada susunan tersimpan: ruangan diisi otomatis, satu server per ruangan.",
    "Nothing saved yet: rooms are filled automatically, one server per room.",
  ),
  noGuilds: both(
    "Bot belum ada di server mana pun. Undang bot ke server Discord Anda dulu.",
    "The bot is not in any server yet. Invite it to your Discord server first.",
  ),
  slotKind: both("Isi", "Shows"),
  slotServer: both("Server", "Server"),
  slotChannel: both("Channel", "Channel"),
  slotLabel: both("Nama ruangan (opsional)", "Room name (optional)"),
  kindNone: both("Kosong", "Empty"),
  kindGuild: both("Satu server", "A server"),
  kindChannel: both("Satu channel", "A channel"),
  kindIdle: both("Ruang AFK (warga idle dan offline)", "AFK room (idle and offline members)"),
  channelText: both("Channel teks", "Text channels"),
  channelVoice: both("Voice channel", "Voice channels"),
  choose: both("Pilih…", "Choose…"),
  save: both("Simpan", "Save"),
  saving: both("Menyimpan…", "Saving…"),
  saved: both("Tersimpan. Kantor langsung mengikuti.", "Saved. The office follows right away."),
  saveIncomplete: both("Lengkapi server dan channel di setiap ruangan yang diisi.", "Pick a server and channel for every room in use."),
  resetAuto: both("Kembali ke otomatis", "Back to automatic"),
} as const satisfies Record<string, LocalizedText>;

export const PRESENCE_LABELS = {
  online: both("Online", "Online"),
  idle: both("Idle", "Idle"),
  dnd: both("Jangan diganggu", "Do not disturb"),
  offline: both("Offline", "Offline"),
} as const satisfies Record<Presence, LocalizedText>;

/** `{where}` is a channel name. Message text is never part of the feed. */
export const FEED_LABELS = {
  online: both("online", "came online"),
  idle: both("lagi idle", "went idle"),
  dnd: both("minta jangan diganggu", "set do not disturb"),
  offline: both("offline", "went offline"),
  voice_join: both("masuk voice {where}", "joined voice {where}"),
  voice_move: both("pindah ke voice {where}", "moved to voice {where}"),
  voice_leave: both("keluar dari voice {where}", "left voice {where}"),
  chat: both("sedang gibah di #{where}", "is chatting in #{where}"),
} as const satisfies Record<FeedKind, LocalizedText>;

type Vars = Readonly<Record<string, string | number>>;

/** Replace `{name}` placeholders. A placeholder with no value is left visible rather than silently dropped. */
export function fill(text: LocalizedText, locale: Locale, vars: Vars): string {
  return localized(text, locale).replace(/\{(\w+)\}/g, (whole, name: string) => (
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole
  ));
}
