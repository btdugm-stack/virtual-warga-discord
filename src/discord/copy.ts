import { localized, type Locale, type LocalizedText } from "../i18n";
import type { ActivityKind, EmoteKind, FeedKind, PartKey, Presence, VoiceState } from "./types";

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
  roomBlocked: both("Bot tidak punya akses", "Bot has no access"),
  warnBlocked: both(
    "Bot tidak diizinkan melihat channel {rooms}, jadi chat di sana tidak terbaca. Beri role bot izin View Channel di channel itu.",
    "The bot is not allowed to see the channel for {rooms}, so chat there goes unnoticed. Give the bot's role View Channel on it.",
  ),
  channelBlocked: both("{name} (bot tidak punya akses)", "{name} (bot has no access)"),
  roomIdle: both("Ruang AFK", "AFK room"),
  roomCorridor: both("Koridor", "Corridor"),
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
  activityTyping: both("Sedang mengetik di #{where}", "Typing in #{where}"),
  activityIdle: both("Lagi bengong", "Away"),
  activityOffline: both("Offline", "Offline"),
  activityNone: both("Nongkrong", "Hanging out"),
  voiceBadge: both("VC · {where}", "VC · {where}"),

  guideOpen: both("Karakter", "Characters"),
  guideTitle: both("Rakit karaktermu", "Build your character"),
  guideClose: both("Tutup panduan karakter", "Close the character guide"),
  guideIntro: both(
    "Untuk merakit karaktermu di sini, situs perlu tahu akun Discord-mu. Ketik /karakter di server Discord yang ada bot ini, lalu tekan Rakit di situs: tautannya hanya untukmu dan berlaku 10 menit. Kamu juga bisa merakit langsung di Discord lewat menu di balasan /karakter. Hanya kamu yang bisa mengubah karaktermu.",
    "To build your character here, the site needs to know your Discord account. Type /karakter in a Discord server that has this bot, then press Rakit di situs: the link is yours alone and lasts 10 minutes. You can also build it right in Discord with the menus in the /karakter reply. Only you can change your character.",
  ),
  guideParts: both(
    "Menu pertama memilih bagian yang diubah: kulit, mata, gaya rambut, warna rambut, atasan, bawahan, sepatu, topi, atau aksesori (sampai tiga). Menu kedua memilih isinya. Acak membuat karakter baru secara acak, Bawaan mengembalikan karakter otomatismu.",
    "The first menu chooses the part to change: skin, eyes, hair style, hair color, top, bottom, shoes, hat, or accessories (up to three). The second menu chooses what goes there. Acak makes a new character at random, Bawaan brings back your automatic one.",
  ),
  guidePhoto: both(
    "Foto profil Discord-mu tidak ditampilkan, kecuali kamu menyalakannya lewat tombol Foto profil. Foto itu lalu dipakai sebagai wajah karakter dan hanya menutupi wajah, jadi rambut dan topi tetap terlihat.",
    "Your Discord profile picture is not shown unless you turn it on with the Foto profil button. It is then worn as the character's face and covers the face only, so hair and hat stay visible.",
  ),
  guideActivity: both(
    "Game, musik, atau tontonan yang sedang kamu buka juga tidak ditampilkan, kecuali kamu menyalakannya lewat tombol Aktivitas. Yang tampil hanya nama game atau aplikasinya.",
    "The game, music, or video you have open is not shown either unless you turn it on with the Aktivitas button. Only the name of the game or app is shown.",
  ),
  guideEmote: both(
    "Ketik /emote untuk membuat karaktermu melambai, joget, melompat, berputar, atau membaca selama beberapa detik.",
    "Type /emote to make your character wave, dance, jump, spin, or read for a few seconds.",
  ),
  signInDiscord: both("Masuk dengan Discord", "Sign in with Discord"),
  signInDemo: both("Coba perakit (mode demo)", "Try the builder (demo mode)"),
  signInFailed: both("Masuk dengan Discord tidak selesai. Coba lagi.", "Signing in with Discord did not finish. Try again."),
  ticketSpent: both(
    "Tautan itu sudah dipakai atau sudah lewat 10 menit. Ketik /karakter lagi di Discord untuk tautan baru.",
    "That link was already used or is more than 10 minutes old. Type /karakter in Discord again for a new one.",
  ),
  notAMember: both(
    "Akun Discord itu bukan anggota server yang ditampilkan di kantor ini, jadi belum punya karakter.",
    "That Discord account is not a member of a server this office shows, so it has no character yet.",
  ),
  builderPreview: both("Karaktermu dari depan, belakang, dan samping", "Your character from the front, the back, and the side"),
  builderFor: both("Karakter {name}", "{name}'s character"),
  builderSections: both("Bagian karakter", "Character parts"),
  builderNone: both("Tanpa", "None"),
  builderAssembled: both("Rakit sendiri", "Assembled"),
  builderAccessories: both("Pilih sampai {max} aksesori. Klik lagi untuk melepas.", "Pick up to {max} accessories. Click again to take one off."),
  builderPhotoOn: both("Foto profil: dipakai", "Profile picture: worn"),
  builderPhotoOff: both("Foto profil: tidak dipakai", "Profile picture: not worn"),
  builderActivityOn: both("Aktivitas: ditampilkan", "Activity: shown"),
  builderActivityOff: both("Aktivitas: tidak ditampilkan", "Activity: not shown"),
  builderRandom: both("Acak", "Random"),
  builderAutomatic: both("Bawaan", "Automatic"),
  builderApply: both("Terapkan", "Apply"),
  builderUnsaved: both("Belum diterapkan.", "Not applied yet."),
  builderSaved: both("Diterapkan. Karaktermu di kantor sudah berganti.", "Applied. Your character in the office has changed."),
  builderSignOut: both("Keluar", "Sign out"),
  guideCatalogAlt: both(
    "Katalog semua bagian karakter: 6 warna kulit, 10 mata, 25 gaya rambut, 12 warna rambut, 25 atasan, 15 bawahan, 8 sepatu, 12 topi, dan 15 aksesori, masing-masing dilihat dari depan, belakang, dan samping.",
    "Catalog of every character part: 6 skin tones, 10 eyes, 25 hair styles, 12 hair colors, 25 tops, 15 bottoms, 8 shoes, 12 hats, and 15 accessories, each seen from the front, the back, and the side.",
  ),

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

export const SECTION_LABELS = {
  whole: both("Karakter jadi", "Ready-made"),
  body: both("Kulit", "Skin"),
  eyes: both("Mata", "Eyes"),
  hair: both("Gaya rambut", "Hair style"),
  hairColor: both("Warna rambut", "Hair color"),
  top: both("Atasan", "Top"),
  bottom: both("Bawahan", "Bottom"),
  shoes: both("Sepatu", "Shoes"),
  hat: both("Topi", "Hat"),
  accessories: both("Aksesori", "Accessories"),
} as const satisfies Record<PartKey | "accessories" | "whole", LocalizedText>;

/** `{name}` is the game or app, as Discord names it. */
export const DOING_LABELS = {
  play: both("Main {name}", "Playing {name}"),
  stream: both("Streaming di {name}", "Streaming on {name}"),
  listen: both("Mendengarkan {name}", "Listening to {name}"),
  watch: both("Menonton {name}", "Watching {name}"),
  compete: both("Bertanding di {name}", "Competing in {name}"),
} as const satisfies Record<ActivityKind, LocalizedText>;

export const VOICE_STATE_LABELS = {
  live: both("live", "live"),
  video: both("kamera", "camera"),
  deaf: both("tuli", "deafened"),
  mute: both("bisu", "muted"),
} as const satisfies Record<VoiceState, LocalizedText>;

/** The glyph that floats up when a character starts an emote. */
export const EMOTE_GLYPHS = { lambai: "👋", joget: "🎶", lompat: "✨", putar: "💫", baca: "📖" } as const satisfies Record<EmoteKind, string>;

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
