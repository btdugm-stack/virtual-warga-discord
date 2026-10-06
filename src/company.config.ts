import type { LocalizedText } from "./i18n";

/**
 * Product names, UI copy, and colors are managed only in this file.
 * Localized values must include all five languages or compilation fails.
 * Product names are not translated.
 */
export const COMPANY = {
  name: "Warga Discord",
  mark: "WD",
  pageTitle: {
    ko: "Warga Discord · 디스코드 활동 오피스",
    en: "Warga Discord · live Discord activity office",
    zh: "Warga Discord · Discord 动态办公室",
    vi: "Warga Discord · văn phòng hoạt động Discord",
    id: "Warga Discord . live activity",
  },
  description: {
    ko: "디스코드 서버와 채널이 방이 되고, 멤버의 접속·음성·채팅 활동이 그대로 보이는 픽셀 오피스",
    en: "A pixel office where Discord servers and channels are the rooms and members' presence, voice, and chat activity show as it happens",
    zh: "Discord 服务器和频道化作房间，成员的在线、语音和聊天动态实时呈现的像素办公室",
    vi: "Văn phòng pixel nơi server và kênh Discord là các phòng, hiển thị trạng thái, voice và chat của thành viên theo thời gian thực",
    id: "Kantor piksel tempat server dan channel Discord menjadi ruangan, menampilkan status, voice, dan chat warganya secara langsung",
  },
  tagline: {
    ko: "누가 접속했고, 어느 음성 채널에 있고, 어디서 수다 중인지 한눈에.",
    en: "Who is online, who is in voice, and who is chatting where.",
    zh: "谁在线、谁在语音、谁在哪儿聊天，一目了然。",
    vi: "Ai đang online, ai đang ở voice, ai đang tám ở đâu.",
    id: "Siapa yang online, siapa yang di voice, dan siapa yang lagi gibah di mana.",
  },
} as const satisfies {
  name: string;
  mark: string;
  pageTitle: LocalizedText;
  description: LocalizedText;
  tagline: LocalizedText;
};

/** UI colors are passed from the configuration as CSS variables. */
export const THEME = {
  app: "#0b1722",
  frame: "#fffaf0",
  panel: "#eef7f3",
  surface: "#dff1ec",
  line: "#afc9c1",
  edge: "#315f70",
  floor: "#fff0cd",
  cream: "#fffdf5",
  ink: "#102b38",
  muted: "#4a6872",
  skin: "#e0ab84",
  wood: "#b66f3e",
  woodDark: "#694229",
  screen: "#164761",
  green: "#55c985",
  amber: "#f3ad32",
  red: "#c63c47",
  focus: "#176bc1",
  shadow: "#05131c",
} as const;

/**
 * The five work rooms of the floor plan. The ids are geometry keys (`office-world.ts`, `globals.css`) kept from
 * the original map; what a room shows is decided at runtime by the Discord server or channel bound to it.
 * `name` is only what an unbound room is called.
 */
export const WORKSPACES = [
  { id: "planning", code: "01", name: { ko: "방 1", en: "Room 1", zh: "房间 1", vi: "Phòng 1", id: "Ruang 1" }, accent: "#f6b73c" },
  { id: "analysis", code: "02", name: { ko: "방 2", en: "Room 2", zh: "房间 2", vi: "Phòng 2", id: "Ruang 2" }, accent: "#58b9e8" },
  { id: "design", code: "03", name: { ko: "방 3", en: "Room 3", zh: "房间 3", vi: "Phòng 3", id: "Ruang 3" }, accent: "#ef71b4" },
  { id: "implementation", code: "04", name: { ko: "방 4", en: "Room 4", zh: "房间 4", vi: "Phòng 4", id: "Ruang 4" }, accent: "#aa8cf2" },
  { id: "monitoring", code: "05", name: { ko: "방 5", en: "Room 5", zh: "房间 5", vi: "Phòng 5", id: "Ruang 5" }, accent: "#4fc484" },
] as const satisfies readonly {
  id: string;
  code: string;
  name: LocalizedText;
  accent: string;
}[];

export type WorkspaceId = (typeof WORKSPACES)[number]["id"];
