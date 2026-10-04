import { COMPANY, WORKSPACES, type WorkspaceId } from "../company.config.ts";
import type { LocalizedText } from "../i18n.ts";

export const OFFICE_COLS = 72;
export const OFFICE_ROWS = 30;
export const MAX_OFFICE_FURNITURE = 240;
export const OFFICE_HEADCOUNT_MIN = 5;
export const OFFICE_HEADCOUNT_MAX = 35;
/* The required range is 20–35 employees. The initial screen must not start below it. */
export const DEFAULT_OFFICE_HEADCOUNT = 20;
export const OFFICE_NAME_MAX = 32;
/** company.config.ts continues to own the product name; use it only when the user has not chosen a company name. */
export const DEFAULT_OFFICE_NAME = COMPANY.name;

export type OfficeTheme = "warm" | "mint" | "violet";
export type FurnitureRotation = 0 | 90 | 180 | 270;
export type OfficePoint = { col: number; row: number };
export type FurnitureCategory = "desks" | "chairs" | "storage" | "decor" | "electronics" | "wall" | "misc";

export type FurnitureCatalogEntry = {
  type: string;
  label: LocalizedText;
  category: FurnitureCategory;
  asset: string;
  footprint: { cols: number; rows: number };
  rotatable: boolean;
  blocksMovement: boolean;
};

/** The shared corridor between the two bands of rooms. Protected, so furniture can never block it. */
export const CORRIDOR_ROWS = [13, 14, 15, 16] as const;

export const OFFICE_FLOOR_ASSETS = Array.from(
  { length: 9 },
  (_, index) => `/office-assets/floors/floor_${index}.png`,
);
export const OFFICE_WALL_ASSETS = ["/office-assets/walls/wall_0.png"] as const;
export const OFFICE_CARPET_ASSETS = Array.from(
  { length: 3 },
  (_, index) => `/office-assets/carpets/carpet_${index}.png`,
);
export const OFFICE_PETS = [
  { type: "claudio", label: "Claudio", asset: "/office-assets/pets/claudio/pet.png" },
  { type: "gitcat", label: "Gitcat", asset: "/office-assets/pets/gitcat/pet.png" },
] as const;

export type OfficeThemeStyle = {
  readonly label: LocalizedText;
  readonly floor: string;
  readonly wall: string;
  readonly wallDark: string;
  readonly trim: string;
  readonly rug: string;
  readonly carpet: string;
  readonly accent: string;
  readonly glow: string;
  readonly surface: string;
  readonly ink: string;
  readonly floorAsset: string;
  readonly wallAsset: string;
  readonly carpetAsset: string;
};

/** Theme values are injected as CSS variables by the renderer. */
export const OFFICE_THEMES = {
  warm: {
    label: { ko: "웜 스튜디오", en: "Warm Studio", zh: "暖色工作室", vi: "Studio ấm", id: "Studio Hangat" },
    floor: "#f4dfb7",
    wall: "#f8efe0",
    wallDark: "#a86f4f",
    trim: "#6f4330",
    rug: "#e5a868",
    carpet: "#d88f51",
    accent: "#d97846",
    glow: "#ffd680",
    surface: "#fff8e8",
    ink: "#2d1f1c",
    floorAsset: OFFICE_FLOOR_ASSETS[7],
    wallAsset: OFFICE_WALL_ASSETS[0],
    carpetAsset: OFFICE_CARPET_ASSETS[0],
  },
  mint: {
    label: { ko: "민트 랩", en: "Mint Lab", zh: "薄荷实验室", vi: "Lab bạc hà", id: "Lab Mint" },
    floor: "#cfe7d8",
    wall: "#edf8ef",
    wallDark: "#5b8977",
    trim: "#315e56",
    rug: "#70b9a1",
    carpet: "#5fae91",
    accent: "#389b7b",
    glow: "#adf3cf",
    surface: "#f6fff8",
    ink: "#173a32",
    floorAsset: OFFICE_FLOOR_ASSETS[4],
    wallAsset: OFFICE_WALL_ASSETS[0],
    carpetAsset: OFFICE_CARPET_ASSETS[2],
  },
  violet: {
    label: { ko: "바이올렛 라운지", en: "Violet Lounge", zh: "紫罗兰休息室", vi: "Lounge tím", id: "Lounge Ungu" },
    floor: "#ddd4ee",
    wall: "#f2effb",
    wallDark: "#76669b",
    trim: "#4e416b",
    rug: "#9a83ca",
    carpet: "#8a71bd",
    accent: "#795bc1",
    glow: "#dfc6ff",
    surface: "#fbf8ff",
    ink: "#302847",
    floorAsset: OFFICE_FLOOR_ASSETS[8],
    wallAsset: OFFICE_WALL_ASSETS[0],
    carpetAsset: OFFICE_CARPET_ASSETS[1],
  },
} as const satisfies Record<OfficeTheme, OfficeThemeStyle>;

const furniture = <const T extends string>(
  type: T,
  label: LocalizedText,
  category: FurnitureCategory,
  asset: string,
  cols: number,
  rows: number,
  rotatable = false,
  blocksMovement = true,
): FurnitureCatalogEntry & { type: T } => ({
  type,
  label,
  category,
  asset: `/office-assets/furniture/${asset}`,
  footprint: { cols, rows },
  rotatable,
  blocksMovement,
});

/** The 25 furniture families bundled by Pixel Agents at revision 9794e075. */
export const FURNITURE_CATALOG = [
  furniture("BIN", { ko: "휴지통", en: "Bin", zh: "垃圾桶", vi: "Thùng rác", id: "Tempat sampah" }, "misc", "BIN/BIN.png", 1, 1),
  furniture("BOOKSHELF", { ko: "책장", en: "Bookshelf", zh: "书架", vi: "Kệ sách", id: "Rak buku" }, "storage", "BOOKSHELF/BOOKSHELF.png", 2, 1, true),
  furniture("CACTUS", { ko: "선인장", en: "Cactus", zh: "仙人掌", vi: "Xương rồng", id: "Kaktus" }, "decor", "CACTUS/CACTUS.png", 1, 2),
  furniture("CLOCK", { ko: "벽시계", en: "Wall clock", zh: "挂钟", vi: "Đồng hồ treo", id: "Jam dinding" }, "wall", "CLOCK/CLOCK.png", 1, 2, false, false),
  furniture("COFFEE", { ko: "커피", en: "Coffee", zh: "咖啡", vi: "Cà phê", id: "Kopi" }, "misc", "COFFEE/COFFEE.png", 1, 1, false, false),
  furniture("COFFEE_TABLE", { ko: "커피 테이블", en: "Coffee table", zh: "茶几", vi: "Bàn trà", id: "Meja kopi" }, "desks", "COFFEE_TABLE/COFFEE_TABLE.png", 2, 2, true),
  furniture("CUSHIONED_BENCH", { ko: "쿠션 벤치", en: "Cushioned bench", zh: "软垫长凳", vi: "Ghế băng đệm", id: "Bangku empuk" }, "chairs", "CUSHIONED_BENCH/CUSHIONED_BENCH.png", 1, 1),
  furniture("CUSHIONED_CHAIR", { ko: "쿠션 의자", en: "Cushioned chair", zh: "软垫椅", vi: "Ghế đệm", id: "Kursi empuk" }, "chairs", "CUSHIONED_CHAIR/CUSHIONED_CHAIR_FRONT.png", 1, 1, true),
  furniture("DESK", { ko: "업무용 책상", en: "Work desk", zh: "办公桌", vi: "Bàn làm việc", id: "Meja kerja" }, "desks", "DESK/DESK_FRONT.png", 3, 2, true),
  furniture("DOUBLE_BOOKSHELF", { ko: "큰 책장", en: "Wide bookshelf", zh: "宽书架", vi: "Kệ sách lớn", id: "Rak buku lebar" }, "storage", "DOUBLE_BOOKSHELF/DOUBLE_BOOKSHELF.png", 2, 2, true),
  furniture("HANGING_PLANT", { ko: "행잉 플랜트", en: "Hanging plant", zh: "吊篮植物", vi: "Cây treo", id: "Tanaman gantung" }, "wall", "HANGING_PLANT/HANGING_PLANT.png", 1, 2, false, false),
  furniture("LARGE_PAINTING", { ko: "큰 그림", en: "Large painting", zh: "大幅画", vi: "Tranh lớn", id: "Lukisan besar" }, "wall", "LARGE_PAINTING/LARGE_PAINTING.png", 2, 2, false, false),
  furniture("LARGE_PLANT", { ko: "큰 화분", en: "Large plant", zh: "大盆栽", vi: "Cây lớn", id: "Tanaman besar" }, "decor", "LARGE_PLANT/LARGE_PLANT.png", 2, 3),
  furniture("PC", { ko: "애니메이션 PC", en: "Animated PC", zh: "动画电脑", vi: "Máy tính động", id: "PC animasi" }, "electronics", "PC/PC_FRONT_ON_1.png", 1, 2, true, false),
  furniture("PLANT", { ko: "화분", en: "Plant", zh: "盆栽", vi: "Chậu cây", id: "Tanaman" }, "decor", "PLANT/PLANT.png", 1, 2),
  furniture("PLANT_2", { ko: "잎 화분", en: "Leafy plant", zh: "绿叶盆栽", vi: "Cây lá", id: "Tanaman berdaun" }, "decor", "PLANT_2/PLANT_2.png", 1, 2),
  furniture("POT", { ko: "작은 화분", en: "Small pot", zh: "小花盆", vi: "Chậu nhỏ", id: "Pot kecil" }, "decor", "POT/POT.png", 1, 1),
  furniture("SMALL_PAINTING", { ko: "작은 그림 A", en: "Small painting A", zh: "小画 A", vi: "Tranh nhỏ A", id: "Lukisan kecil A" }, "wall", "SMALL_PAINTING/SMALL_PAINTING.png", 1, 2, false, false),
  furniture("SMALL_PAINTING_2", { ko: "작은 그림 B", en: "Small painting B", zh: "小画 B", vi: "Tranh nhỏ B", id: "Lukisan kecil B" }, "wall", "SMALL_PAINTING_2/SMALL_PAINTING_2.png", 1, 2, false, false),
  furniture("SMALL_TABLE", { ko: "작은 테이블", en: "Small table", zh: "小桌", vi: "Bàn nhỏ", id: "Meja kecil" }, "desks", "SMALL_TABLE/SMALL_TABLE_FRONT.png", 2, 2, true),
  furniture("SOFA", { ko: "소파", en: "Sofa", zh: "沙发", vi: "Ghế sofa", id: "Sofa" }, "chairs", "SOFA/SOFA_FRONT.png", 2, 1, true),
  furniture("TABLE_FRONT", { ko: "회의 테이블", en: "Meeting table", zh: "会议桌", vi: "Bàn họp", id: "Meja rapat" }, "desks", "TABLE_FRONT/TABLE_FRONT.png", 3, 4, true),
  furniture("WHITEBOARD", { ko: "화이트보드", en: "Whiteboard", zh: "白板", vi: "Bảng trắng", id: "Papan tulis" }, "wall", "WHITEBOARD/WHITEBOARD.png", 2, 2, false, false),
  furniture("WOODEN_BENCH", { ko: "나무 벤치", en: "Wooden bench", zh: "木长凳", vi: "Ghế băng gỗ", id: "Bangku kayu" }, "chairs", "WOODEN_BENCH/WOODEN_BENCH.png", 1, 1),
  furniture("WOODEN_CHAIR", { ko: "나무 의자", en: "Wooden chair", zh: "木椅", vi: "Ghế gỗ", id: "Kursi kayu" }, "chairs", "WOODEN_CHAIR/WOODEN_CHAIR_FRONT.png", 1, 2, true),
] as const;

export type OfficeFurnitureType = (typeof FURNITURE_CATALOG)[number]["type"];
export type OfficeFurniture = {
  readonly uid: string;
  readonly type: OfficeFurnitureType;
  readonly col: number;
  readonly row: number;
  readonly rotation: FurnitureRotation;
  readonly hue: number;
};
export type OfficeLayout = {
  readonly version: 4;
  readonly officeName: string;
  readonly theme: OfficeTheme;
  readonly headcount: number;
  readonly furniture: readonly OfficeFurniture[];
};

export type WorkspaceZone = {
  readonly id: WorkspaceId;
  readonly code: string;
  readonly name: LocalizedText;
  readonly accent: string;
  readonly col: number;
  readonly row: number;
  readonly cols: number;
  readonly rows: number;
  readonly door: OfficePoint;
};

export type AmenityZone = {
  readonly id: "library" | "cafe" | "lounge" | "dining";
  readonly code: string;
  readonly name: LocalizedText;
  readonly role: LocalizedText;
  readonly accent: string;
  readonly col: number;
  readonly row: number;
  readonly cols: number;
  readonly rows: number;
  readonly door: OfficePoint;
  readonly aisleCol: number;
  readonly seats: readonly OfficePoint[];
  readonly entryPoints: readonly OfficePoint[];
};

/* The five work rooms in reading order: three along the top band, two along the bottom. */
const ZONE_GEOMETRY = {
  planning: { col: 1, row: 1, cols: 15, rows: 11, door: { col: 7, row: 12 } },
  analysis: { col: 17, row: 1, cols: 15, rows: 11, door: { col: 23, row: 12 } },
  design: { col: 33, row: 1, cols: 14, rows: 11, door: { col: 39, row: 12 } },
  implementation: { col: 1, row: 18, cols: 20, rows: 11, door: { col: 21, row: 24 } },
  monitoring: { col: 27, row: 18, cols: 20, rows: 11, door: { col: 26, row: 24 } },
} as const satisfies Record<WorkspaceId, Pick<WorkspaceZone, "col" | "row" | "cols" | "rows" | "door">>;

export const WORKSPACE_ZONES: readonly WorkspaceZone[] = WORKSPACES.map((workspace) => ({
  ...ZONE_GEOMETRY[workspace.id],
  id: workspace.id,
  code: workspace.code,
  name: workspace.name,
  accent: workspace.accent,
}));

export const WORKSPACE_SEATS = {
  planning: [{ col: 7, row: 8 }, { col: 3, row: 8 }, { col: 11, row: 8 }],
  analysis: [{ col: 23, row: 8 }, { col: 19, row: 8 }, { col: 27, row: 8 }],
  design: [{ col: 39, row: 8 }, { col: 35, row: 8 }, { col: 43, row: 8 }],
  implementation: [{ col: 10, row: 24 }, { col: 6, row: 24 }, { col: 14, row: 24 }],
  monitoring: [{ col: 37, row: 24 }, { col: 33, row: 24 }, { col: 41, row: 24 }],
} as const satisfies Record<WorkspaceId, readonly [OfficePoint, OfficePoint, OfficePoint]>;

export const AMENITY_ZONES = [
  {
    id: "library", code: "LIB",
    name: { ko: "도서관", en: "Library", zh: "图书室", vi: "Thư viện", id: "Perpustakaan" },
    role: { ko: "조용히 읽고 정리하는 곳", en: "A quiet place to read and sort things out", zh: "安静阅读和整理的地方", vi: "Nơi yên tĩnh để đọc và sắp xếp", id: "Tempat tenang untuk membaca dan merapikan" },
    accent: "#5f8fb4",
    col: 48, row: 1, cols: 11, rows: 11, door: { col: 53, row: 12 }, aisleCol: 53,
    seats: [
      { col: 49, row: 11 }, { col: 54, row: 11 }, { col: 58, row: 11 },
      { col: 49, row: 8 }, { col: 54, row: 8 }, { col: 58, row: 8 }, { col: 54, row: 5 },
      { col: 49, row: 4 }, { col: 58, row: 4 }, { col: 53, row: 2 },
    ],
    entryPoints: [
      { col: 49, row: 13 }, { col: 57, row: 13 }, { col: 50, row: 13 }, { col: 56, row: 13 },
      { col: 51, row: 13 }, { col: 55, row: 13 }, { col: 53, row: 13 },
      { col: 52, row: 13 }, { col: 54, row: 13 }, { col: 48, row: 13 },
    ],
  },
  {
    id: "cafe", code: "CAFE",
    name: { ko: "카페", en: "Café", zh: "咖啡厅", vi: "Quán cà phê", id: "Kafe" },
    role: { ko: "커피를 마시며 쉬는 곳", en: "A place to take a break over coffee", zh: "喝咖啡休息的地方", vi: "Nơi nghỉ ngơi bên tách cà phê", id: "Tempat rehat sambil menikmati kopi" },
    accent: "#d87943",
    col: 60, row: 1, cols: 11, rows: 11, door: { col: 65, row: 12 }, aisleCol: 65,
    seats: [
      { col: 62, row: 11 }, { col: 66, row: 11 }, { col: 70, row: 11 },
      { col: 62, row: 8 }, { col: 66, row: 8 }, { col: 70, row: 8 },
      { col: 66, row: 5 }, { col: 62, row: 2 }, { col: 66, row: 2 },
    ],
    entryPoints: [
      { col: 63, row: 13 }, { col: 64, row: 13 }, { col: 65, row: 13 },
      { col: 66, row: 13 }, { col: 67, row: 13 }, { col: 68, row: 13 },
      { col: 61, row: 13 }, { col: 62, row: 13 }, { col: 69, row: 13 },
    ],
  },
  {
    id: "lounge", code: "REST",
    name: { ko: "휴게실", en: "Lounge", zh: "休息室", vi: "Phòng nghỉ", id: "Ruang Santai" },
    role: { ko: "소파에 앉아 쉬는 곳", en: "A place to sit back on the sofa", zh: "坐在沙发上放松的地方", vi: "Nơi ngả lưng trên ghế sofa", id: "Tempat bersantai di sofa" },
    accent: "#9b7bc7",
    col: 48, row: 18, cols: 11, rows: 11, door: { col: 53, row: 17 }, aisleCol: 53,
    seats: [
      { col: 49, row: 26 }, { col: 54, row: 26 }, { col: 58, row: 26 },
      { col: 49, row: 23 }, { col: 54, row: 23 }, { col: 58, row: 23 },
      { col: 54, row: 20 }, { col: 58, row: 20 },
    ],
    entryPoints: [
      { col: 49, row: 16 }, { col: 50, row: 16 }, { col: 51, row: 16 },
      { col: 52, row: 16 }, { col: 53, row: 16 }, { col: 54, row: 16 },
      { col: 55, row: 16 }, { col: 56, row: 16 },
    ],
  },
  {
    id: "dining", code: "DINE",
    name: { ko: "식당", en: "Dining", zh: "餐厅", vi: "Nhà ăn", id: "Ruang Makan" },
    role: { ko: "함께 식사하는 곳", en: "A place to eat together", zh: "一起用餐的地方", vi: "Nơi cùng nhau dùng bữa", id: "Tempat makan bersama" },
    accent: "#73a55d",
    col: 60, row: 18, cols: 11, rows: 11, door: { col: 65, row: 17 }, aisleCol: 65,
    seats: [
      { col: 62, row: 26 }, { col: 66, row: 26 }, { col: 70, row: 26 },
      { col: 62, row: 23 }, { col: 66, row: 23 }, { col: 70, row: 23 },
      { col: 66, row: 20 }, { col: 70, row: 20 },
    ],
    entryPoints: [
      { col: 63, row: 16 }, { col: 64, row: 16 }, { col: 65, row: 16 },
      { col: 66, row: 16 }, { col: 67, row: 16 }, { col: 68, row: 16 },
      { col: 62, row: 16 }, { col: 69, row: 16 },
    ],
  },
] as const satisfies readonly AmenityZone[];

const LEGACY_AMENITY_ROUTES = [
  { aisleCol: 53, door: { col: 53, row: 12 }, seats: [{ col: 49, row: 9 }, { col: 53, row: 9 }, { col: 57, row: 9 }, { col: 57, row: 4 }] },
  { aisleCol: 65, door: { col: 65, row: 12 }, seats: [{ col: 61, row: 9 }, { col: 65, row: 9 }, { col: 69, row: 9 }, { col: 69, row: 4 }] },
  { aisleCol: 53, door: { col: 53, row: 17 }, seats: [{ col: 49, row: 25 }, { col: 53, row: 25 }, { col: 57, row: 25 }, { col: 57, row: 20 }] },
  { aisleCol: 65, door: { col: 65, row: 17 }, seats: [{ col: 61, row: 25 }, { col: 65, row: 25 }, { col: 69, row: 25 }, { col: 69, row: 20 }] },
] as const;

const AMENITY_BYPASSES = [
  { aisleCol: 53, row: 10, toCol: 58 }, { aisleCol: 53, row: 7, toCol: 58 },
  { aisleCol: 65, row: 10, toCol: 70 }, { aisleCol: 65, row: 7, toCol: 70 },
  { aisleCol: 53, row: 25, toCol: 58 }, { aisleCol: 53, row: 22, toCol: 58 },
  { aisleCol: 65, row: 25, toCol: 70 }, { aisleCol: 65, row: 22, toCol: 70 },
] as const;

export const AMENITY_SEATS: readonly OfficePoint[] = AMENITY_ZONES.reduce<OfficePoint[]>(
  (all, { seats }) => [...all, ...seats],
  [],
);

export const AMENITY_ENTRY_POINTS: readonly OfficePoint[] = AMENITY_ZONES.reduce<OfficePoint[]>(
  (all, { entryPoints }) => [...all, ...entryPoints],
  [],
);

export const ENTRANCE = { col: 23, row: 28 } as const;
export const OFFICE_DOORS = [
  { col: 7, row: 12 }, { col: 8, row: 12 },
  { col: 23, row: 12 }, { col: 24, row: 12 },
  { col: 39, row: 12 }, { col: 40, row: 12 },
  { col: 21, row: 23 }, { col: 21, row: 24 },
  { col: 26, row: 23 }, { col: 26, row: 24 },
  { col: 23, row: 29 }, { col: 24, row: 29 },
  { col: 53, row: 12 }, { col: 54, row: 12 },
  { col: 65, row: 12 }, { col: 66, row: 12 },
  { col: 53, row: 17 }, { col: 54, row: 17 },
  { col: 65, row: 17 }, { col: 66, row: 17 },
] as const satisfies readonly OfficePoint[];

/*
 * Arrival and departure points. The first is the lobby's main entrance, an existing opening in the bottom wall;
 * the second is the elevator at the corridor's east end. They must be visibly separated on screen to show
 * employees "pouring out of the door and elevator." Corridor rows 13–16 are entirely protected tiles,
 * so furniture cannot block the elevator entrance.
 */
export const SPAWN_DOORS = [{ col: 23, row: 29 }, { col: 70, row: 14 }] as const satisfies readonly OfficePoint[];

/** Where the elevator door is drawn — the east wall immediately beside SPAWN_DOORS[1]. Move them together. */
export const ELEVATOR_SHAFT = { col: 71, row: 13, cols: 1, rows: 4 } as const;

export function spawnPointFor(agentIndex: number): { point: OfficePoint; via: "door" | "elevator" } {
  const index = agentIndex % SPAWN_DOORS.length;
  return { point: SPAWN_DOORS[index], via: index === 0 ? "door" : "elevator" };
}

const pointKey = ({ col, row }: OfficePoint) => `${col},${row}`;

function makeWalls() {
  const walls = new Set<string>();
  const add = (col: number, row: number) => walls.add(`${col},${row}`);
  const doors = new Set(OFFICE_DOORS.map(pointKey));
  for (let col = 0; col < OFFICE_COLS; col += 1) {
    add(col, 0);
    if (!doors.has(`${col},${OFFICE_ROWS - 1}`)) add(col, OFFICE_ROWS - 1);
    if (!doors.has(`${col},12`)) add(col, 12);
    if ((col < 22 || col > 25) && !doors.has(`${col},17`)) add(col, 17);
  }
  for (let row = 0; row < OFFICE_ROWS; row += 1) {
    add(0, row);
    add(OFFICE_COLS - 1, row);
  }
  for (let row = 1; row < 12; row += 1) {
    add(16, row);
    add(32, row);
    add(47, row);
    add(59, row);
  }
  for (let row = 18; row < OFFICE_ROWS; row += 1) {
    if (!doors.has(`21,${row}`)) add(21, row);
    if (!doors.has(`26,${row}`)) add(26, row);
    add(47, row);
    add(59, row);
  }
  return walls;
}

function makeProtectedTiles(
  amenityRoutes: readonly {
    readonly aisleCol: number;
    readonly door: OfficePoint;
    readonly seats: readonly OfficePoint[];
  }[] = AMENITY_ZONES,
  bypasses: readonly { readonly aisleCol: number; readonly row: number; readonly toCol: number }[] = AMENITY_BYPASSES,
) {
  const tiles = new Set<string>(OFFICE_DOORS.map(pointKey));
  const protect = (col: number, row: number) => tiles.add(`${col},${row}`);
  for (let row = 13; row <= 16; row += 1) {
    for (let col = 1; col < OFFICE_COLS - 1; col += 1) protect(col, row);
  }
  for (let row = 17; row < OFFICE_ROWS; row += 1) {
    for (let col = 22; col <= 25; col += 1) protect(col, row);
  }
  for (const { id, door } of WORKSPACE_ZONES) {
    const [primary, left, right] = WORKSPACE_SEATS[id];
    if (door.row === 12) {
      for (let row = primary.row; row <= door.row; row += 1) protect(primary.col, row);
    }
    const from = Math.min(primary.col, left.col, right.col, door.col);
    const to = Math.max(primary.col, left.col, right.col, door.col);
    for (let col = from; col <= to; col += 1) protect(col, primary.row);
    protect(primary.col, primary.row);
    protect(left.col, left.row);
    protect(right.col, right.row);
  }
  for (const { aisleCol, door, seats } of amenityRoutes) {
    const rows = [door.row, ...seats.map(({ row }) => row)];
    for (let row = Math.min(...rows); row <= Math.max(...rows); row += 1) protect(aisleCol, row);
    for (const seat of seats) {
      const from = Math.min(aisleCol, seat.col);
      const to = Math.max(aisleCol, seat.col);
      for (let col = from; col <= to; col += 1) protect(col, seat.row);
    }
  }
  for (const { aisleCol, row, toCol } of bypasses) {
    for (let col = aisleCol; col <= toCol; col += 1) protect(col, row);
  }
  return tiles;
}

const WALL_KEYS = makeWalls();
const PROTECTED_KEYS = makeProtectedTiles();
const LEGACY_PROTECTED_KEYS = makeProtectedTiles(LEGACY_AMENITY_ROUTES, []);
export const OFFICE_WALL_TILES = [...WALL_KEYS].map(parsePoint);
export const OFFICE_PROTECTED_TILES = [...PROTECTED_KEYS].map(parsePoint);

const CATALOG_BY_TYPE = new Map<string, FurnitureCatalogEntry>(
  FURNITURE_CATALOG.map((entry) => [entry.type, entry]),
);

function item(
  uid: string,
  type: OfficeFurnitureType,
  col: number,
  row: number,
  hue: number,
  rotation: FurnitureRotation = 0,
): OfficeFurniture {
  return { uid, type, col, row, rotation, hue };
}

export const AMENITY_FURNITURE: readonly OfficeFurniture[] = [
  item("amenity-library-shelf-1", "DOUBLE_BOOKSHELF", 48, 2, 205),
  item("amenity-library-shelf-2", "DOUBLE_BOOKSHELF", 50, 2, 205),
  item("amenity-library-shelf-3", "DOUBLE_BOOKSHELF", 56, 5, 205),
  item("amenity-library-table", "SMALL_TABLE", 49, 5, 205),
  item("amenity-library-art", "LARGE_PAINTING", 54, 2, 205),
  item("amenity-library-plant", "PLANT", 48, 9, 205),

  item("amenity-cafe-sofa", "SOFA", 60, 2, 28),
  item("amenity-cafe-table-1", "COFFEE_TABLE", 61, 5, 28),
  item("amenity-cafe-coffee-1", "COFFEE", 61, 5, 28),
  item("amenity-cafe-table-2", "COFFEE_TABLE", 67, 5, 28),
  item("amenity-cafe-coffee-2", "COFFEE", 67, 5, 28),
  item("amenity-cafe-plant", "PLANT", 70, 2, 28),

  item("amenity-lounge-sofa-1", "SOFA", 48, 27, 284),
  item("amenity-lounge-sofa-2", "SOFA", 52, 27, 284),
  item("amenity-lounge-sofa-3", "SOFA", 56, 27, 284),
  item("amenity-lounge-table", "COFFEE_TABLE", 49, 18, 284),
  item("amenity-lounge-plant", "PLANT", 48, 18, 284),
  item("amenity-lounge-art", "LARGE_PAINTING", 56, 18, 284),

  item("amenity-dining-table", "TABLE_FRONT", 60, 18, 92),
  item("amenity-dining-cup-1", "COFFEE", 61, 18, 92),
  item("amenity-dining-small-table", "SMALL_TABLE", 67, 18, 92),
  item("amenity-dining-cup-2", "COFFEE", 67, 18, 92),
  item("amenity-dining-bench-1", "WOODEN_BENCH", 60, 27, 92),
  item("amenity-dining-bench-2", "WOODEN_BENCH", 64, 27, 92),
  item("amenity-dining-bench-3", "WOODEN_BENCH", 68, 27, 92),
  item("amenity-dining-bin", "BIN", 70, 27, 92),
];

function defaultFurniture(): OfficeFurniture[] {
  return [
    // Room 1 — a meeting table under the board, with desks facing it.
    item("planning-table", "TABLE_FRONT", 6, 2, 38),
    item("planning-desk-1", "DESK", 2, 6, 38),
    item("planning-pc-1", "PC", 3, 6, 38),
    item("planning-desk-2", "DESK", 10, 6, 38),
    item("planning-pc-2", "PC", 11, 6, 38),
    item("planning-desk-3", "DESK", 6, 6, 38),
    item("planning-pc-3", "PC", 7, 6, 38),
    item("planning-shelf", "BOOKSHELF", 2, 2, 38),
    item("planning-board", "WHITEBOARD", 11, 2, 38),
    item("planning-clock", "CLOCK", 14, 2, 38),
    item("planning-plant", "PLANT", 14, 9, 38),

    // Room 2 — shelves and a board around side-on desks.
    item("analysis-desk-1", "DESK", 18, 5, 196, 90),
    item("analysis-pc-1", "PC", 18, 6, 196, 90),
    item("analysis-desk-2", "DESK", 22, 5, 196, 90),
    item("analysis-pc-2", "PC", 22, 6, 196, 90),
    item("analysis-desk-3", "DESK", 29, 5, 196, 270),
    item("analysis-pc-3", "PC", 29, 6, 196, 270),
    item("analysis-shelf-1", "DOUBLE_BOOKSHELF", 18, 2, 196),
    item("analysis-shelf-2", "DOUBLE_BOOKSHELF", 20, 2, 196),
    item("analysis-board", "WHITEBOARD", 26, 2, 196),
    item("analysis-plant", "LARGE_PLANT", 30, 9, 196),

    // Room 3 — a large table with pictures pinned along the wall.
    item("design-table", "TABLE_FRONT", 38, 2, 326),
    item("design-pc", "PC", 39, 5, 326),
    item("design-desk-1", "DESK", 34, 5, 326, 90),
    item("design-pc-1", "PC", 34, 6, 326, 90),
    item("design-desk-2", "DESK", 43, 5, 326, 270),
    item("design-pc-2", "PC", 43, 6, 326, 270),
    item("design-shelf", "BOOKSHELF", 34, 2, 326),
    item("design-mockup-1", "SMALL_PAINTING", 36, 2, 326),
    item("design-mockup-2", "SMALL_PAINTING_2", 41, 2, 326),
    item("design-board", "LARGE_PAINTING", 43, 2, 326),
    item("design-plant", "PLANT_2", 45, 9, 326),

    /*
     * Room 4 — two rows of workstations; the front row sits right above the fixed seats.
     * The top-left corner of both lower rooms stays clear: the room label is drawn there.
     */
    item("implementation-desk-1", "DESK", 11, 19, 270),
    item("implementation-pc-1", "PC", 12, 19, 270),
    item("implementation-desk-2", "DESK", 15, 19, 270),
    item("implementation-pc-2", "PC", 16, 19, 270),
    item("implementation-desk-3", "DESK", 5, 22, 270),
    item("implementation-pc-3", "PC", 6, 22, 270),
    item("implementation-desk-4", "DESK", 9, 22, 270),
    item("implementation-pc-4", "PC", 10, 22, 270),
    item("implementation-desk-5", "DESK", 13, 22, 270),
    item("implementation-pc-5", "PC", 14, 22, 270),
    item("implementation-board", "WHITEBOARD", 2, 21, 270),
    item("implementation-shelf", "DOUBLE_BOOKSHELF", 18, 18, 270),
    item("implementation-sofa", "SOFA", 2, 27, 270),
    item("implementation-coffee-table", "COFFEE_TABLE", 5, 26, 270),
    item("implementation-coffee", "COFFEE", 5, 26, 270),
    item("implementation-plant", "LARGE_PLANT", 18, 25, 270),

    // Room 5 — a wall of screens above the desks.
    item("monitoring-wall-1", "DESK", 34, 19, 145),
    item("monitoring-screen-1", "PC", 35, 19, 145),
    item("monitoring-wall-2", "DESK", 38, 19, 145),
    item("monitoring-screen-2", "PC", 39, 19, 145),
    item("monitoring-wall-3", "DESK", 42, 19, 145),
    item("monitoring-screen-3", "PC", 43, 19, 145),
    item("monitoring-desk-1", "DESK", 32, 22, 145),
    item("monitoring-pc-1", "PC", 33, 22, 145),
    item("monitoring-desk-2", "DESK", 36, 22, 145),
    item("monitoring-pc-2", "PC", 37, 22, 145),
    item("monitoring-desk-3", "DESK", 40, 22, 145),
    item("monitoring-pc-3", "PC", 41, 22, 145),
    item("monitoring-board", "WHITEBOARD", 29, 21, 145),
    item("monitoring-clock", "CLOCK", 46, 19, 145),
    item("monitoring-sofa", "SOFA", 28, 27, 145),
    item("monitoring-plant", "LARGE_PLANT", 44, 25, 145),

    ...AMENITY_FURNITURE,
  ];
}

export const DEFAULT_OFFICE_LAYOUT: OfficeLayout = {
  version: 4,
  officeName: DEFAULT_OFFICE_NAME,
  theme: "warm",
  headcount: DEFAULT_OFFICE_HEADCOUNT,
  furniture: defaultFurniture(),
};

export function furnitureFootprint(
  value: OfficeFurniture | string,
  rotation: FurnitureRotation = typeof value === "string" ? 0 : value.rotation,
): { cols: number; rows: number } {
  const type = typeof value === "string" ? value : value.type;
  const entry = CATALOG_BY_TYPE.get(type);
  if (!entry) throw new Error(`Unknown furniture type: ${type}`);
  const { cols, rows } = entry.footprint;
  return rotation === 90 || rotation === 270 ? { cols: rows, rows: cols } : { cols, rows };
}

export function furnitureTiles(value: OfficeFurniture): OfficePoint[] {
  const { cols, rows } = furnitureFootprint(value);
  const tiles: OfficePoint[] = [];
  for (let row = value.row; row < value.row + rows; row += 1) {
    for (let col = value.col; col < value.col + cols; col += 1) tiles.push({ col, row });
  }
  return tiles;
}

export function blockedOfficeTiles(layout: OfficeLayout, ignoreUid?: string): Set<string> {
  const blocked = new Set<string>();
  for (const value of layout.furniture) {
    if (value.uid === ignoreUid || !CATALOG_BY_TYPE.get(value.type)?.blocksMovement) continue;
    for (const tile of furnitureTiles(value)) blocked.add(pointKey(tile));
  }
  return blocked;
}

export type OfficeSeat = OfficePoint & { readonly facing: "up" | "down" | "left" | "right" };

/** Every room a Discord binding can fill, in slot order: the five work rooms, then the four amenity rooms. */
export const ROOM_ZONES: readonly (WorkspaceZone | AmenityZone)[] = [...WORKSPACE_ZONES, ...AMENITY_ZONES];

const AMENITY_FACING = ["up", "left", "right", "up"] as const;
/** Extra seats are laid out on a staggered grid this far apart, so nameplates do not stack on each other. */
const SEAT_COL_STEP = 3;
const SEAT_ROW_STEP = 2;

/**
 * Seats per room, in the order they fill. The hand-placed seats come first (they face a desk or a table);
 * after those, open floor inside the room is used so a busy server is not limited to three chairs.
 * Extra seats skip protected walkways and anything the entrance cannot reach, so nobody is seated in an aisle
 * or behind furniture. Recomputed when furniture moves.
 */
export function roomSeats(layout: OfficeLayout = DEFAULT_OFFICE_LAYOUT): readonly (readonly OfficeSeat[])[] {
  const blocked = blockedOfficeTiles(layout);
  const reachable = new Set<string>([pointKey(ENTRANCE)]);
  const queue: OfficePoint[] = [ENTRANCE];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const [dc, dr] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const next = { col: current.col + dc, row: current.row + dr };
      const key = pointKey(next);
      if (reachable.has(key) || !inBounds(next) || WALL_KEYS.has(key) || blocked.has(key)) continue;
      reachable.add(key);
      queue.push(next);
    }
  }
  return ROOM_ZONES.map((zone, zoneIndex) => {
    const fixed: OfficeSeat[] = zoneIndex < WORKSPACE_ZONES.length
      ? WORKSPACE_SEATS[zone.id as WorkspaceId].map((seat) => ({ ...seat, facing: "up" }))
      : (zone as AmenityZone).seats.map((seat) => ({
        ...seat,
        facing: AMENITY_FACING[(zoneIndex - WORKSPACE_ZONES.length) % AMENITY_FACING.length],
      }));
    const usable = fixed.filter((seat) => reachable.has(pointKey(seat)));
    const extra: OfficeSeat[] = [];
    // Leave the top two rows to the wall furniture and the room label.
    for (let row = zone.row + 2; row < zone.row + zone.rows; row += SEAT_ROW_STEP) {
      const stagger = ((row - zone.row) / SEAT_ROW_STEP) % 2 ? 1 : 0;
      for (let col = zone.col + 1 + stagger; col < zone.col + zone.cols - 1; col += SEAT_COL_STEP) {
        const key = pointKey({ col, row });
        if (!reachable.has(key) || PROTECTED_KEYS.has(key)) continue;
        if (usable.some((seat) => Math.abs(seat.col - col) <= 1 && Math.abs(seat.row - row) <= 1)) continue;
        extra.push({ col, row, facing: "down" });
      }
    }
    const centerCol = zone.col + zone.cols / 2;
    const centerRow = zone.row + zone.rows / 2;
    const fromCenter = (seat: OfficeSeat) => Math.abs(seat.col - centerCol) + Math.abs(seat.row - centerRow);
    extra.sort((a, b) => fromCenter(a) - fromCenter(b));
    return [...usable, ...extra];
  });
}

export function isOfficeWall(point: OfficePoint): boolean {
  return WALL_KEYS.has(pointKey(point));
}

export function isOfficeWalkable(
  point: OfficePoint,
  layout: OfficeLayout = DEFAULT_OFFICE_LAYOUT,
  ignoreUid?: string,
): boolean {
  return inBounds(point) && !isOfficeWall(point) && !blockedOfficeTiles(layout, ignoreUid).has(pointKey(point));
}

/** Four-neighbor BFS. The result excludes start and includes end. */
export function findOfficePath(
  start: OfficePoint,
  end: OfficePoint,
  layout: OfficeLayout = DEFAULT_OFFICE_LAYOUT,
  occupied: ReadonlySet<string> = new Set(),
): OfficePoint[] {
  if (!inBounds(start) || isOfficeWall(start) || !isOfficeWalkable(end, layout)) return [];
  const startKey = pointKey(start);
  const endKey = pointKey(end);
  if (startKey === endKey) return [];
  if (occupied.has(endKey)) return [];
  const blocked = blockedOfficeTiles(layout);
  const queue: OfficePoint[] = [start];
  const parents = new Map<string, string>();
  const visited = new Set([startKey]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const [dc, dr] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const next = { col: current.col + dc, row: current.row + dr };
      const key = pointKey(next);
      if (visited.has(key) || !inBounds(next) || WALL_KEYS.has(key) || blocked.has(key) || occupied.has(key)) continue;
      parents.set(key, pointKey(current));
      if (key === endKey) return reconstructPath(startKey, endKey, parents);
      visited.add(key);
      queue.push(next);
    }
  }
  return [];
}

const NO_TILES: ReadonlySet<string> = new Set();

export function canPlaceFurniture(
  layout: OfficeLayout,
  value: OfficeFurniture,
  ignoreUid?: string,
  /** Tiles currently occupied by employees. Placing furniture there makes people and furniture overlap. */
  standing: ReadonlySet<string> = NO_TILES,
): boolean {
  return canPlaceFurnitureAgainst(layout, value, PROTECTED_KEYS, ignoreUid, standing);
}

function canPlaceFurnitureAgainst(
  layout: OfficeLayout,
  value: OfficeFurniture,
  protectedKeys: ReadonlySet<string>,
  ignoreUid?: string,
  standing: ReadonlySet<string> = NO_TILES,
): boolean {
  if (!isFurniture(value)) return false;
  const occupied = blockedOfficeTiles(layout, ignoreUid);
  const blocksMovement = CATALOG_BY_TYPE.get(value.type)?.blocksMovement ?? true;
  for (const tile of furnitureTiles(value)) {
    const key = pointKey(tile);
    if (!inBounds(tile) || WALL_KEYS.has(key) || protectedKeys.has(key)) return false;
    // Objects that do not block paths, such as rugs, may sit under employees' feet.
    if (blocksMovement && (occupied.has(key) || standing.has(key))) return false;
  }
  return true;
}

/** How far a dropped piece may slide to find room. */
const PLACEMENT_REACH = 4;
/** Offsets within reach, nearest first. */
const NEARBY_OFFSETS: readonly (readonly [number, number])[] = (() => {
  const offsets: [number, number][] = [];
  for (let dr = -PLACEMENT_REACH; dr <= PLACEMENT_REACH; dr += 1) {
    for (let dc = -PLACEMENT_REACH; dc <= PLACEMENT_REACH; dc += 1) offsets.push([dc, dr]);
  }
  return offsets.sort((a, b) => (a[0] ** 2 + a[1] ** 2) - (b[0] ** 2 + b[1] ** 2));
})();

/**
 * Where a piece dropped at `value` actually goes: that spot when it is free, else the closest free spot a few
 * tiles around it. A table several tiles wide rarely fits exactly under the pointer, and refusing every
 * near miss makes the editor feel broken. Null when nothing nearby is free.
 */
export function nearestFurniturePlacement(
  layout: OfficeLayout,
  value: OfficeFurniture,
  standing: ReadonlySet<string> = NO_TILES,
  ignoreUid?: string,
): OfficeFurniture | null {
  for (const [dc, dr] of NEARBY_OFFSETS) {
    const candidate = { ...value, col: value.col + dc, row: value.row + dr };
    if (canPlaceFurniture(layout, candidate, ignoreUid, standing)) return candidate;
  }
  return null;
}

function firstAvailableFurniturePosition(
  layout: OfficeLayout,
  value: OfficeFurniture,
): OfficeFurniture | null {
  const size = furnitureFootprint(value);
  const originalZone = AMENITY_ZONES.find(({ col, row, cols, rows }) => (
    value.col >= col && value.col < col + cols && value.row >= row && value.row < row + rows
  ));
  const findNearest = (minCol: number, maxCol: number, minRow: number, maxRow: number) => {
    for (let distance = 0; distance < OFFICE_COLS + OFFICE_ROWS; distance += 1) {
      for (let row = minRow; row <= maxRow; row += 1) {
        const colOffset = distance - Math.abs(row - value.row);
        if (colOffset < 0) continue;
        for (const col of colOffset ? [value.col - colOffset, value.col + colOffset] : [value.col]) {
          if (col < minCol || col > maxCol) continue;
          const candidate = { ...value, col, row };
          if (canPlaceFurniture(layout, candidate)) return candidate;
        }
      }
    }
    return null;
  };
  if (originalZone) {
    const nearby = findNearest(
      originalZone.col,
      originalZone.col + originalZone.cols - size.cols,
      originalZone.row,
      originalZone.row + originalZone.rows - size.rows,
    );
    if (nearby) return nearby;
  }
  return findNearest(0, OFFICE_COLS - size.cols, 0, OFFICE_ROWS - size.rows);
}

/** Keyboard placement starts at the first valid open tile, then uses the normal move controls. */
export function firstAvailableFurnitureCenter(
  layout: OfficeLayout,
  type: OfficeFurnitureType,
  /** Tiles occupied by employees. Filter them here too so keyboard placement does not immediately reject its chosen position. */
  standing: ReadonlySet<string> = NO_TILES,
): OfficePoint | null {
  const size = furnitureFootprint(type);
  for (let row = 0; row <= OFFICE_ROWS - size.rows; row += 1) {
    for (let col = 0; col <= OFFICE_COLS - size.cols; col += 1) {
      const candidate: OfficeFurniture = { uid: "keyboard-placement", type, col, row, rotation: 0, hue: 0 };
      if (canPlaceFurniture(layout, candidate, undefined, standing)) {
        return { col: col + Math.floor(size.cols / 2), row: row + Math.floor(size.rows / 2) };
      }
    }
  }
  return null;
}

export function withOfficeFurniture(layout: OfficeLayout, value: OfficeFurniture): OfficeLayout {
  const index = layout.furniture.findIndex(({ uid }) => uid === value.uid);
  if (index < 0 && layout.furniture.length >= MAX_OFFICE_FURNITURE) throw new Error("Office furniture limit reached");
  if (!canPlaceFurniture(layout, value, index < 0 ? undefined : value.uid)) throw new Error("Furniture cannot be placed there");
  const furniture = [...layout.furniture];
  if (index < 0) furniture.push({ ...value });
  else furniture[index] = { ...value };
  return { ...layout, furniture };
}

export function withoutOfficeFurniture(layout: OfficeLayout, uid: string): OfficeLayout {
  const furniture = layout.furniture.filter((value) => value.uid !== uid);
  return furniture.length === layout.furniture.length ? layout : { ...layout, furniture };
}

/** Strict renderer-side validation for persisted data. */
export function checkedOfficeLayout(input: unknown): OfficeLayout {
  if (!isRecord(input)) throw new Error("Invalid office layout");
  const legacy = input.version === 1 || input.version === 2;
  const named = input.version === 4;
  if (!hasExactKeys(
    input,
    legacy
      ? ["version", "theme", "furniture"]
      : named
        ? ["version", "officeName", "theme", "headcount", "furniture"]
        : ["version", "theme", "headcount", "furniture"],
  )) {
    throw new Error("Invalid office layout");
  }
  if (
    (!legacy && !named && input.version !== 3)
    || typeof input.theme !== "string"
    || !Object.prototype.hasOwnProperty.call(OFFICE_THEMES, input.theme)
  ) throw new Error("Invalid office layout");
  const officeName = named ? checkedOfficeName(input.officeName) : DEFAULT_OFFICE_NAME;
  const headcount = legacy ? DEFAULT_OFFICE_HEADCOUNT : checkedOfficeHeadcount(input.headcount);
  const inputLimit = input.version === 1 ? 200 : MAX_OFFICE_FURNITURE;
  if (!Array.isArray(input.furniture) || input.furniture.length > inputLimit) throw new Error("Invalid office furniture");
  const existingUids = new Set(input.furniture.flatMap((value) => (
    isRecord(value) && typeof value.uid === "string" ? [value.uid] : []
  )));
  const rawFurniture = input.version === 1
    ? [...input.furniture, ...AMENITY_FURNITURE.filter(({ uid }) => !existingUids.has(uid))]
    : input.furniture;
  const seen = new Set<string>();
  const legacyAccepted: OfficeFurniture[] = [];
  const accepted: OfficeFurniture[] = [];
  for (const [index, raw] of rawFurniture.entries()) {
    if (!isFurniture(raw) || seen.has(raw.uid)) throw new Error("Invalid office furniture");
    const original = { ...raw };
    if (input.version === 1 && index < input.furniture.length && original.col + furnitureFootprint(original).cols > 48) {
      throw new Error("Invalid office furniture placement");
    }
    const legacyLayout = {
      version: 4 as const,
      officeName,
      theme: input.theme as OfficeTheme,
      headcount: headcount as number,
      furniture: legacyAccepted,
    };
    if (!canPlaceFurnitureAgainst(legacyLayout, original, legacy ? LEGACY_PROTECTED_KEYS : PROTECTED_KEYS)) {
      throw new Error("Invalid office furniture placement");
    }
    legacyAccepted.push(original);
    const migratedLayout = { ...legacyLayout, furniture: accepted };
    const candidate = canPlaceFurniture(migratedLayout, original)
      ? original
      : legacy && firstAvailableFurniturePosition(migratedLayout, original);
    if (!candidate) throw new Error("Invalid office furniture placement");
    seen.add(original.uid);
    accepted.push(candidate);
  }
  const layout: OfficeLayout = {
    version: 4,
    officeName,
    theme: input.theme as OfficeTheme,
    headcount: headcount as number,
    furniture: accepted,
  };
  const seats = [...Object.values(WORKSPACE_SEATS).flat(), ...AMENITY_SEATS];
  for (const seat of seats) {
    if (!findOfficePath(ENTRANCE, seat, layout).length) throw new Error("Office paths must remain connected");
  }
  return layout;
}

/**
 * Validate only headcount. Running full validation for a change that leaves furniture intact (the headcount slider)
 * repeats the O(n²) overlap check and BFS across 45 seats at each step, freezing the screen for 40–50ms.
 */
export function checkedOfficeHeadcount(input: unknown): number {
  if (
    !Number.isInteger(input)
    || (input as number) < OFFICE_HEADCOUNT_MIN
    || (input as number) > OFFICE_HEADCOUNT_MAX
  ) throw new Error("Invalid office headcount");
  return input as number;
}

/** The company name occupies one line in the header and lobby sign, so reject line breaks and control characters. */
export function checkedOfficeName(input: unknown): string {
  if (typeof input !== "string") throw new Error("Invalid office name");
  const text = input.trim();
  if (!text || text.length > OFFICE_NAME_MAX || /[\p{Cc}\p{Zl}\p{Zp}]/u.test(text)) {
    throw new Error("Invalid office name");
  }
  return text;
}

function isFurniture(input: unknown): input is OfficeFurniture {
  if (!isRecord(input) || !hasExactKeys(input, ["uid", "type", "col", "row", "rotation", "hue"])) return false;
  return typeof input.uid === "string"
    && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(input.uid)
    && typeof input.type === "string"
    && CATALOG_BY_TYPE.has(input.type)
    && Number.isInteger(input.col)
    && Number.isInteger(input.row)
    && [0, 90, 180, 270].includes(input.rotation as number)
    && Number.isInteger(input.hue)
    && (input.hue as number) >= 0
    && (input.hue as number) <= 359;
}

function reconstructPath(start: string, end: string, parents: Map<string, string>): OfficePoint[] {
  const path: OfficePoint[] = [];
  for (let key = end; key !== start; key = parents.get(key)!) path.push(parsePoint(key));
  return path.reverse();
}

function parsePoint(key: string): OfficePoint {
  const [col, row] = key.split(",").map(Number);
  return { col, row };
}

function inBounds({ col, row }: OfficePoint): boolean {
  return Number.isInteger(col) && Number.isInteger(row) && col >= 0 && col < OFFICE_COLS && row >= 0 && row < OFFICE_ROWS;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === "object" && !Array.isArray(input);
}

function hasExactKeys(input: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(input);
  return actual.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(input, key));
}
