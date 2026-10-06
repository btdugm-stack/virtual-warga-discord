"use client";

import type { CSSProperties, DragEvent, KeyboardEvent, MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { adminToken, storeAdminToken } from "./discord/admin";
import { AGENT_HUES, SPRITE_COUNT } from "./discord/characters";
import { COPY, EMOTE_GLYPHS, PRESENCE_LABELS, fill } from "./discord/copy";
import { activityText, doingText, roomNote, roomTitle, voiceText } from "./discord/rooms";
import type { Member, RoomState } from "./discord/types";
import { localized, t, type Locale, type MessageKey } from "./i18n";
import {
  CORRIDOR_ROOM,
  CORRIDOR_ROWS,
  DEFAULT_OFFICE_LAYOUT,
  FURNITURE_CATALOG,
  OFFICE_COLS,
  OFFICE_ROWS,
  OFFICE_THEMES,
  ROOM_ZONES,
  WORKSPACE_ZONES,
  canPlaceFurniture,
  checkedOfficeLayout,
  ELEVATOR_SHAFT,
  findOfficePath,
  firstAvailableFurnitureCenter,
  furnitureFootprint,
  nearestFurniturePlacement,
  roomSeats,
  spawnPointFor,
  type FurnitureRotation,
  type OfficeFurniture,
  type OfficeFurnitureType,
  type OfficeLayout,
  type OfficePoint,
  type OfficeSeat,
  type OfficeTheme,
} from "./game/office-world";

export type OfficeWorldProps = {
  /** One entry per room of the floor plan, in `ROOM_ZONES` order. */
  rooms: readonly RoomState[];
  /** Everyone to show. Someone who drops out of this list walks to a door and leaves. */
  members: readonly Member[];
  /** The room the close-up camera centers on, or null for the middle of the floor. */
  activeRoom: number | null;
  /** Changes when an admin saves the shared furniture layout; the office then loads it again. */
  layoutRev: number;
  ready: boolean;
  locale: Locale;
  clock: { label: string; time: string };
  /** Where the furniture editor is drawn. The shell passes its side dock so the editor never covers the floor. */
  editorHost?: HTMLElement | null;
  onEditorOpenChange?: (open: boolean) => void;
};

type WorldStyle = CSSProperties & Record<`--${string}`, string | number>;
type Direction = "left" | "right" | "up" | "down";
/** A member with their color variant resolved to degrees, plus the small per-person offsets used when walking. */
type Actor = Member & { sprite: number; hue: number; jitter: number; door: number };
type AgentMotion = {
  /** The tile currently being approached. The reference point for arrival checks and path progress. */
  point: OfficePoint;
  /** The interpolation start tile. progress fills the gap between it and point. */
  from: OfficePoint;
  /** 0 → 1. At 1, snap to point and select the next tile. */
  progress: number;
  path: OfficePoint[];
  /** The tile `path` leads to. A different target (new seat, stroll, leaving) invalidates the path. */
  targetKey: string;
  layoutKey: string;
  direction: Direction;
  moving: boolean;
  /** Arrival staging — absent from the screen until this performance.now timestamp. */
  arriveAt: number;
  /** Reconsideration time that prevents a stationary person from finding a path every frame. */
  decideAt: number;
  /** Gone from Discord's online list — heads for a door instead of a seat and leaves the screen upon reaching it. */
  leaving: boolean;
  /** A corridor tile this person is wandering to, or null when headed for their seat. */
  stroll: OfficePoint | null;
};
type SeatRef = { room: number; index: number };
type CameraView = "full" | "close";
type LayoutHistory = { past: OfficeLayout[]; present: OfficeLayout; future: OfficeLayout[] };

const HUES = [
  { value: 0, label: "hue.original" },
  { value: 42, label: "hue.gold" },
  { value: 120, label: "hue.mint" },
  { value: 210, label: "hue.blue" },
  { value: 300, label: "hue.pink" },
] as const satisfies readonly { value: number; label: MessageKey }[];

function seatAsset(direction: Direction) {
  const view = direction === "up" ? "BACK" : direction === "down" ? "FRONT" : "SIDE";
  return `/office-assets/furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_${view}.png`;
}

/** DOM helper called inside rAF — leave unchanged values alone to avoid style recalculation. */
function attr(el: HTMLElement, name: string, value: string) {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

/**
 * Interpolate walking every frame instead of breaking it into tile-sized steps. Previously, employees
 * teleported one tile every 200–300ms while CSS `transition: left/top` caught up, but the 0.3s transition
 * exceeded the step interval, so every transition was cut short and looked like rubber-band dragging.
 */
const WALK_TILES_PER_SEC = 3.6;
/** Maximum time advanced at once, preventing simulation teleports after a long frame. */
const MAX_FRAME_SECONDS = 0.05;
/** Offset that aligns the feet of a 48×96 sprite frame with the tile center. */
const SPRITE_W = 48;
const SPRITE_H = 96;
/** Feet land at different heights when standing and sitting. These preserve the old CSS values of -80% / -67%. */
const FOOT_ANCHOR = 0.8;
const SEATED_FOOT_ANCHOR = 0.67;
/**
 * Arrival staging — interval between people emerging from a door.
 * Walking to a seat takes about six seconds, so a tighter interval causes a crowd at the door.
 */
const ARRIVAL_STAGGER_MS = 420;
/** A whole server coming online at once still gets everyone through the doors within this time. */
const ARRIVAL_BATCH_MS = 8000;
/** The camera eases toward its target. Larger values catch up faster. */
const CAMERA_EASE = 0.11;
/**
 * Sprites are fixed at 48×96, while tiles can shrink to about 15px with the stage.
 * Unscaled, one person occupies 3×7 tiles and exceeds the furniture, so lock height to a tile count.
 */
const AGENT_TILES_TALL = 2.6;
const MIN_AGENT_SCALE = 0.3;
/** If a nameplate cannot grow even this large, it is unreadable — collapse it to clear the view. */
const LABEL_LEGIBLE_SCALE = 0.58;
/**
 * Nameplates for people seated through this row in the upper band overflow above the stage, so push them down
 * (`.world-agent[data-edge-seat]`). The lower band has a corridor above it, so nothing can overflow there.
 */
const TOP_BAND_SEAT_ROW = 5;
/** Above this many people, seated characters are drawn smaller so the rooms stay readable. */
const CROWDED_FROM = 16;
/** While nobody is talking, about this share of the people with nothing to do wander the corridor. */
const STROLL_SHARE = 0.25;
const STROLL_MAX = 6;

/** Drag payload prefix for a piece taken from the catalog; a placed piece's uid can never contain a colon. */
const NEW_PIECE = "new:";

const clamp = (value: number, limit: number) => Math.min(limit, Math.max(-limit, value));

/**
 * A uid persists in saved data, so it must not collide across sessions. Time alone can produce two values in the
 * same millisecond, so append randomness. This lives outside the component because calling it during render is impure.
 */
function newFurnitureUid() {
  return globalThis.crypto?.randomUUID?.()
    ?? `office-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffff).toString(36)}`;
}

/** FNV-1a. Spreads people across the two doors, and across the characters when the server names none. */
function hashOf(text: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function actorFor(member: Member): Actor {
  const hash = hashOf(member.id);
  return {
    ...member,
    // Only used when the server is older than this page and names no character: one of the ready-made sprites,
    // tinted, so nobody is drawn without a body.
    sprite: hash % SPRITE_COUNT,
    hue: AGENT_HUES[(hash >>> 4) % AGENT_HUES.length],
    // A subtle tile-unit offset that keeps people passing through the same tile from overlapping exactly.
    jitter: (((hash >>> 8) % 11) - 5) * 0.03,
    door: (hash >>> 12) % 2,
  };
}

function motionAt(point: OfficePoint, direction: Direction, arriveAt: number): AgentMotion {
  return {
    point: { ...point },
    from: { ...point },
    progress: 1,
    path: [],
    targetKey: "",
    layoutKey: "",
    direction,
    moving: false,
    arriveAt,
    decideAt: arriveAt,
    leaving: false,
    stroll: null,
  };
}

/** Arrival — stage a person by a door or the elevator and admit them to the world at the scheduled time. */
function doorMotion(actor: Actor, arriveAt: number): AgentMotion {
  const spawn = spawnPointFor(actor.door);
  // The main entrance is on the bottom wall, so people enter facing up; the elevator is at the east end, so they face west toward the corridor.
  return motionAt(spawn.point, spawn.via === "elevator" ? "left" : "up", arriveAt);
}

function navigationKey(layout: OfficeLayout) {
  return layout.furniture
    .map(({ uid, type, col, row, rotation }) => `${uid}:${type}:${col}:${row}:${rotation}`)
    .join("|");
}

function samePoint(a: OfficePoint, b: OfficePoint) {
  return a.col === b.col && a.row === b.row;
}

function directionBetween(from: OfficePoint, to: OfficePoint): Direction {
  if (to.col !== from.col) return to.col > from.col ? "right" : "left";
  return to.row > from.row ? "down" : "up";
}

function doorDirection(zone: { col: number; row: number; cols: number; rows: number; door: OfficePoint }) {
  if (zone.door.col < zone.col) return "left";
  if (zone.door.col >= zone.col + zone.cols) return "right";
  if (zone.door.row < zone.row) return "top";
  return "bottom";
}

function rectStyle(col: number, row: number, cols = 1, rows = 1): WorldStyle {
  return {
    "--world-x": `${(col / OFFICE_COLS) * 100}%`,
    "--world-y": `${(row / OFFICE_ROWS) * 100}%`,
    "--world-w": `${(cols / OFFICE_COLS) * 100}%`,
    "--world-h": `${(rows / OFFICE_ROWS) * 100}%`,
  };
}

function eventPoint(
  element: HTMLElement,
  clientX: number,
  clientY: number,
): OfficePoint {
  const rect = element.getBoundingClientRect();
  return {
    col: Math.max(0, Math.min(OFFICE_COLS - 1, Math.floor(((clientX - rect.left) / rect.width) * OFFICE_COLS))),
    row: Math.max(0, Math.min(OFFICE_ROWS - 1, Math.floor(((clientY - rect.top) / rect.height) * OFFICE_ROWS))),
  };
}

export function OfficeWorld({
  rooms,
  members,
  activeRoom,
  layoutRev,
  ready,
  locale,
  clock,
  editorHost,
  onEditorOpenChange,
}: OfficeWorldProps) {
  const [history, setHistory] = useState<LayoutHistory>({
    past: [],
    present: DEFAULT_OFFICE_LAYOUT,
    future: [],
  });
  /*
   * Who is drawn: everyone with a seat, plus anyone still walking out. `unseated` counts, per room, the people
   * the room has no chair for; they are reported as "+N" on the room label.
   */
  const [stage, setStage] = useState<{ actors: readonly Actor[]; unseated: readonly number[] }>({ actors: [], unseated: [] });
  // The rAF loop reads the same list from a ref so it does not restart on every Discord update.
  const actorsRef = useRef<readonly Actor[]>([]);
  // Motion lives in a ref, not state. Calling setState every frame would rerender the entire editor too.
  const motionsRef = useRef(new Map<string, AgentMotion>());
  // Seats are kept across updates, so a person stays in their chair until they change rooms.
  const assignedRef = useRef(new Map<string, SeatRef>());
  const agentEls = useRef(new Map<string, HTMLLIElement>());
  const cameraEl = useRef<HTMLDivElement>(null);
  const stageEl = useRef<HTMLDivElement>(null);
  const stageSize = useRef({ width: 0, height: 0 });
  const cam = useRef({ x: 0.5, y: 0.5, scale: 1 });
  const camTarget = useRef({ x: 0.5, y: 0.5, scale: 1 });
  const [editorOpen, setEditorOpen] = useState(false);
  const [placingType, setPlacingType] = useState<OfficeFurnitureType | null>(null);
  // Where the piece being placed would land under the pointer, and whether there is room for it.
  const [ghost, setGhost] = useState<{ item: OfficeFurniture; valid: boolean } | null>(null);
  const ghostTile = useRef<OfficePoint | null>(null);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [cameraView, setCameraView] = useState<CameraView>("full");
  // Whether the camera follows the selected room. Turn it off to keep one spot in view.
  const [follow, setFollow] = useState(true);
  const [cameraPan, setCameraPan] = useState<{ x: number; y: number; room: number | null }>({
    x: 0,
    y: 0,
    room: null,
  });
  const [reducedMotion, setReducedMotion] = useState(false);
  // Store the key, not the copy, so the latest notice changes with the language.
  const [saveState, setSaveState] = useState<MessageKey>("layout.editable");
  const [saving, setSaving] = useState(false);
  const editRevision = useRef(0);
  // Edits not yet saved. A layout arriving from the server must not wipe them out.
  const unsaved = useRef(false);
  const strollCheckAt = useRef(0);
  // Camera motion is read every frame, so the state must also be kept in a ref.
  const panOffset = useRef({ x: 0, y: 0 });
  const panStart = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null);
  const layout = history.present;
  const layoutRef = useRef(layout);
  const pathLayoutKey = navigationKey(layout);
  const seats = useMemo(() => roomSeats(layout), [layout]);
  const { actors, unseated } = stage;

  const selected = layout.furniture.find(({ uid }) => uid === selectedUid) ?? null;
  const theme = OFFICE_THEMES[layout.theme];
  const crowded = actors.length > CROWDED_FROM;
  const voiceCount = members.filter(({ voice }) => voice !== null).length;
  const chatCount = members.filter(({ chat }) => chat !== null).length;
  // Someone is in voice or chatting somewhere: screens light up and the floor gets its light sweep.
  const lively = rooms.some(({ live }) => live);
  const activeZone = activeRoom === null ? undefined : ROOM_ZONES[activeRoom];
  const cameraClose = cameraView === "close" && !editorOpen;
  const cameraScale = cameraClose ? 1.65 : 1;
  /*
   * Drag room comes from scale, not view mode. At 1×, the entire floor already fits in the frame,
   * leaving nowhere to drag. If zoom increases later, this condition alone enables dragging with it.
   */
  const canPan = cameraScale > 1;
  const cameraFocus = activeZone
    ? { col: activeZone.col + activeZone.cols / 2, row: activeZone.row + activeZone.rows / 2 }
    : { col: OFFICE_COLS / 2, row: OFFICE_ROWS / 2 };
  const visibleCameraPan = cameraPan.room === activeRoom ? cameraPan : { x: 0, y: 0 };
  const visibleSelectedAgentId = actors.some(({ id }) => id === selectedAgentId) ? selectedAgentId : null;

  // The camera eases toward its target in rAF, not via a CSS transition. Update only the target here.
  useEffect(() => {
    camTarget.current.scale = cameraScale;
    panOffset.current = cameraClose
      ? { x: visibleCameraPan.x, y: visibleCameraPan.y }
      : { x: 0, y: 0 };
    if (!cameraClose) {
      camTarget.current.x = 0.5;
      camTarget.current.y = 0.5;
      return;
    }
    // While tracking is off, keep the current view even when another room is selected.
    if (!follow) return;
    camTarget.current.x = cameraFocus.col / OFFICE_COLS;
    camTarget.current.y = cameraFocus.row / OFFICE_ROWS;
  }, [follow, cameraClose, cameraFocus.col, cameraFocus.row, cameraScale, visibleCameraPan.x, visibleCameraPan.y]);

  // Pixel coordinates require the stage size. Measure it again only on resize.
  useEffect(() => {
    const node = stageEl.current;
    if (!node) return;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      stageSize.current = { width: rect.width, height: rect.height };
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    onEditorOpenChange?.(editorOpen);
  }, [editorOpen, onEditorOpenChange]);

  // The furniture layout is shared: load what the admin saved, and again whenever a new one is saved.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/layout")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("unreadable"))))
      .then((body: { layout: unknown }) => {
        if (cancelled || unsaved.current) return;
        if (body.layout === null) {
          setSaveState("layout.none");
          return;
        }
        let loaded: OfficeLayout;
        try {
          loaded = checkedOfficeLayout(body.layout);
        } catch {
          setSaveState("layout.invalid");
          return;
        }
        // Our own save comes back through here too; keep the undo history when nothing actually changed.
        if (JSON.stringify(loaded) === JSON.stringify(layoutRef.current)) return;
        setHistory({ past: [], present: loaded, future: [] });
        setSelectedUid(null);
        setSaveState("layout.loaded");
      })
      .catch(() => {
        if (!cancelled) setSaveState("layout.unreadable");
      });
    return () => {
      cancelled = true;
    };
  }, [layoutRev]);

  /*
   * Follow Discord: seat everyone in their room, bring newcomers in through a door, and send away whoever is gone.
   * Seats and motion are refs, so this only decides who is on the floor; the rAF loop does the walking.
   */
  useEffect(() => {
    const now = performance.now();
    const motions = motionsRef.current;
    const assigned = assignedRef.current;
    const byId = new Map(members.map((member) => [member.id, member]));

    // Free the chair of anyone who left, changed rooms, or whose chair was removed by a furniture edit.
    for (const [id, seat] of assigned) {
      if (byId.get(id)?.room !== seat.room || seat.index >= seats[seat.room].length) assigned.delete(id);
    }
    const taken = seats.map(() => new Set<number>());
    for (const seat of assigned.values()) taken[seat.room].add(seat.index);

    const noChair = seats.map(() => 0);
    const next: Actor[] = [];
    const arrivals: Actor[] = [];
    for (const member of members) {
      const list = seats[member.room];
      if (!list) continue;
      if (!assigned.has(member.id)) {
        const index = list.findIndex((_, seatIndex) => !taken[member.room].has(seatIndex));
        if (index < 0) {
          noChair[member.room] += 1;
          continue;
        }
        taken[member.room].add(index);
        assigned.set(member.id, { room: member.room, index });
      }
      const actor = actorFor(member);
      next.push(actor);
      const motion = motions.get(member.id);
      if (!motion) arrivals.push(actor);
      else if (motion.leaving) {
        // Back before reaching the door: turn around.
        motion.leaving = false;
        motion.decideAt = 0;
      }
    }

    const stagger = Math.min(ARRIVAL_STAGGER_MS, ARRIVAL_BATCH_MS / Math.max(1, arrivals.length));
    arrivals.forEach((actor, order) => {
      const seat = assigned.get(actor.id)!;
      const chair = seats[seat.room][seat.index];
      motions.set(actor.id, reducedMotion ? motionAt(chair, chair.facing, 0) : doorMotion(actor, now + order * stagger));
    });

    for (const [id, motion] of motions) {
      if (assigned.has(id)) continue;
      // Without walking, or before they ever came through the door, there is no exit to show.
      if (reducedMotion || now < motion.arriveAt) {
        motions.delete(id);
        continue;
      }
      if (!motion.leaving) {
        motion.leaving = true;
        motion.stroll = null;
        motion.decideAt = 0;
      }
      const last = actorsRef.current.find((actor) => actor.id === id);
      if (last) next.push({ ...last, voice: null, chat: null });
      else motions.delete(id);
    }

    actorsRef.current = next;
    setStage({ actors: next, unseated: noChair });
  }, [members, reducedMotion, seats]);

  useEffect(() => {
    if (!ready) return;
    const seatOf = (id: string): OfficeSeat | undefined => {
      const seat = assignedRef.current.get(id);
      return seat ? seats[seat.room]?.[seat.index] : undefined;
    };
    /** Only someone online with nothing going on wanders; anyone in voice, chatting, or idle stays put. */
    const mayStroll = (actor: Actor) => actor.presence === "online" && !actor.voice && !actor.chat;

    /** Keep a few people walking the corridor — the device that makes the floor feel alive. */
    const balanceStroll = (now: number, motions: Map<string, AgentMotion>, list: readonly Actor[]) => {
      if (now < strollCheckAt.current) return;
      strollCheckAt.current = now + 2500 + Math.random() * 4000;
      const free = list.filter((actor) => mayStroll(actor) && !motions.get(actor.id)?.leaving);
      const strolling = free.filter((actor) => motions.get(actor.id)?.stroll).length;
      if (strolling >= Math.min(STROLL_MAX, Math.floor(free.length * STROLL_SHARE))) return;
      const resting = free.filter((actor) => {
        const motion = motions.get(actor.id);
        const seat = seatOf(actor.id);
        return motion && seat && !motion.moving && !motion.stroll && now >= motion.arriveAt && samePoint(motion.point, seat);
      });
      if (!resting.length) return;
      const motion = motions.get(resting[Math.floor(Math.random() * resting.length)].id)!;
      motion.stroll = {
        col: 2 + Math.floor(Math.random() * (OFFICE_COLS - 4)),
        row: CORRIDOR_ROWS[Math.floor(Math.random() * CORRIDOR_ROWS.length)],
      };
      motion.decideAt = 0;
    };

    /**
     * A person who finishes one tile chooses the next. Only people in mid-step block a tile: seated and
     * standing people can be walked past, so a full room or a narrow doorway never traps anyone.
     */
    const decide = (actor: Actor, motion: AgentMotion, now: number, stepping: Set<string>): boolean => {
      const seat = seatOf(actor.id);
      if (motion.stroll && !mayStroll(actor)) motion.stroll = null;
      const leaving = motion.leaving || !seat;
      const target = leaving ? spawnPointFor(actor.door).point : motion.stroll ?? seat;
      const targetKey = `${target.col},${target.row}`;

      /** Stand still and wait until the next reconsideration — otherwise pathfinding runs every frame. */
      const settle = (waitMs = 220 + ((actor.door * 53 + actor.sprite * 29) % 160)) => {
        motion.moving = false;
        motion.decideAt = now + waitMs;
      };

      if (samePoint(motion.point, target)) {
        motion.path = [];
        // Reached the door — off the floor. Coming back online brings them in again.
        if (leaving) return true;
        if (motion.stroll) {
          // Pause at the far end of the walk, then head home.
          motion.stroll = null;
          settle(1500 + Math.random() * 2500);
          return false;
        }
        motion.direction = seat.facing;
        settle();
        return false;
      }
      if (motion.targetKey !== targetKey || motion.layoutKey !== pathLayoutKey || !motion.path.length) {
        motion.path = findOfficePath(motion.point, target, layout);
        motion.targetKey = targetKey;
        motion.layoutKey = pathLayoutKey;
      }
      const point = motion.path[0];
      // No route (furniture was just moved in the way), or someone is stepping onto the next tile: wait and retry.
      if (!point || stepping.has(`${point.col},${point.row}`)) {
        settle();
        return false;
      }
      stepping.add(`${point.col},${point.row}`);
      motion.from = { ...motion.point };
      motion.point = point;
      motion.progress = 0;
      motion.path = motion.path.slice(1);
      motion.direction = directionBetween(motion.from, point);
      motion.moving = true;
      return false;
    };

    const advance = (now: number, dt: number) => {
      const motions = motionsRef.current;
      const list = actorsRef.current;
      balanceStroll(now, motions, list);

      const stepping = new Set<string>();
      for (const actor of list) {
        const motion = motions.get(actor.id);
        if (motion && motion.progress < 1) stepping.add(`${motion.point.col},${motion.point.row}`);
      }

      const gone: string[] = [];
      for (const actor of list) {
        const motion = motions.get(actor.id);
        // Before entering through a door, treat the person as outside the world.
        if (!motion || now < motion.arriveAt) continue;
        if (motion.progress < 1) {
          motion.progress = Math.min(1, motion.progress + WALK_TILES_PER_SEC * dt);
          if (motion.progress < 1) continue;
          motion.from = { ...motion.point };
          motion.decideAt = 0;
        }
        if (now < motion.decideAt) continue;
        if (decide(actor, motion, now, stepping)) gone.push(actor.id);
      }
      if (!gone.length) return;
      for (const id of gone) motions.delete(id);
      const remaining = actorsRef.current.filter(({ id }) => !gone.includes(id));
      actorsRef.current = remaining;
      setStage((current) => ({ ...current, actors: remaining }));
    };

    /** With reduced motion enabled, nobody walks — everyone is simply in their seat. */
    const snapToSeats = () => {
      for (const actor of actorsRef.current) {
        const motion = motionsRef.current.get(actor.id);
        const seat = seatOf(actor.id);
        if (!motion || !seat || (samePoint(motion.point, seat) && motion.progress === 1)) continue;
        Object.assign(motion, motionAt(seat, seat.facing, 0));
      }
    };

    const paint = (now: number) => {
      const motions = motionsRef.current;
      const { width, height } = stageSize.current;
      if (!width || !height) return;
      const tileW = width / OFFICE_COLS;
      const tileH = height / OFFICE_ROWS;
      const target = camTarget.current;
      const view = cam.current;
      // For users who prefer reduced motion, snap into place without easing.
      const ease = reducedMotion ? 1 : CAMERA_EASE;
      view.x += (target.x - view.x) * ease;
      view.y += (target.y - view.y) * ease;
      view.scale += (target.scale - view.scale) * ease;
      // Fit character height to the tiles. It must shrink with a narrower stage to preserve proportions with furniture.
      const agentScale = Math.min(1, Math.max(MIN_AGENT_SCALE, (tileH * AGENT_TILES_TALL) / SPRITE_H));
      const camNode = cameraEl.current;
      if (camNode) {
        // Pan only by the zoomed amount. Going farther moves the floor outside the frame and exposes an empty stage.
        const limitX = Math.max(0, ((view.scale - 1) / 2) * width);
        const limitY = Math.max(0, ((view.scale - 1) / 2) * height);
        const offsetX = clamp((0.5 - view.x) * view.scale * width + panOffset.current.x, limitX);
        const offsetY = clamp((0.5 - view.y) * view.scale * height + panOffset.current.y, limitY);
        camNode.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${view.scale})`;
        // Nameplates and speech bubbles become unreadable if they shrink with people. Counteract the shrinkage.
        camNode.style.setProperty("--label-counter", (1 / agentScale).toFixed(3));
        // This must be a data attribute, not a class — React overwrites the entire className when rerendering.
        attr(camNode, "data-compact", agentScale * view.scale < LABEL_LEGIBLE_SCALE ? "true" : "false");
      }

      for (const actor of actorsRef.current) {
        const el = agentEls.current.get(actor.id);
        const motion = motions.get(actor.id);
        if (!el || !motion) continue;
        const offstage = now < motion.arriveAt;
        attr(el, "data-offstage", offstage ? "true" : "false");
        if (offstage) continue;

        const seat = seatOf(actor.id);
        const col = motion.from.col + (motion.point.col - motion.from.col) * motion.progress + 0.5 + actor.jitter;
        const row = motion.from.row + (motion.point.row - motion.from.row) * motion.progress + 0.5;
        const atSeat = !!seat && !motion.leaving && !motion.moving && samePoint(motion.point, seat);
        // Someone chatting or typing stands up at their place and types; an emote is done standing too.
        // Everyone else at their place sits.
        const chatting = atSeat && (actor.chat !== null || !!actor.typing);
        const emote = atSeat && !chatting && actor.emote ? actor.emote.kind : "";
        // There are no chairs in the corridor; people there stand.
        const seated = atSeat && !chatting && !emote && actor.room !== CORRIDOR_ROOM;
        const pose = chatting ? 1.12 : seated ? (crowded ? 0.8 : 0.9) : 1;
        const scale = pose * agentScale;
        /*
         * With transform-origin at center bottom, scaling does not change the foot coordinates.
         * Therefore subtract the box dimensions (SPRITE_W/H) at their original size and scale only the extra space
         * that positions the sprite below the tile. This space corresponds to the old CSS values of -80% / -67%.
         */
        const overhang = (1 - (seated ? SEATED_FOOT_ANCHOR : FOOT_ANCHOR)) * SPRITE_H * scale;
        const transform =
          `translate3d(${col * tileW - SPRITE_W / 2}px, ${row * tileH - SPRITE_H + overhang}px, 0) scale(${scale})`;
        // Rewriting the same value makes the browser recalculate styles. Most people are stationary.
        if (el.dataset.transform !== transform) {
          el.dataset.transform = transform;
          el.style.transform = transform;
          el.style.zIndex = String(10 + Math.round(row));
        }
        if (seat && el.dataset.facing !== seat.facing) {
          el.dataset.facing = seat.facing;
          el.style.setProperty("--seat-asset", `url("${seatAsset(seat.facing)}")`);
        }

        // An emote is done facing the viewer, or half the seats would show it from behind.
        attr(el, "data-direction", emote ? "down" : motion.direction);
        attr(el, "data-moving", motion.moving ? "true" : "false");
        attr(el, "data-resting", seated ? "true" : "false");
        attr(el, "data-working", chatting ? "true" : "false");
        attr(el, "data-emote", emote);
        attr(el, "data-edge-seat", seated && seat.row <= TOP_BAND_SEAT_ROW ? "true" : "false");
        attr(el, "data-popover-side", motion.point.col > OFFICE_COLS * 0.7 ? "left" : "right");
      }
    };

    let raf = 0;
    let previous = performance.now();
    const frame = (now: number) => {
      if (reducedMotion) snapToSeats();
      else advance(now, Math.min((now - previous) / 1000, MAX_FRAME_SECONDS));
      previous = now;
      paint(now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [crowded, layout, pathLayoutKey, ready, reducedMotion, seats]);

  function markChanged() {
    editRevision.current += 1;
    unsaved.current = true;
    setSaveState("layout.unsaved");
  }

  function commitLayout(next: OfficeLayout) {
    if (saving) return;
    let checked: OfficeLayout;
    try {
      checked = checkedOfficeLayout(next);
    } catch {
      // The piece fits on its own tiles but would cut a seat off from the entrance.
      setSaveState("layout.blockedPlacement");
      return;
    }
    setHistory((current) => ({
      past: [...current.past.slice(-29), current.present],
      present: checked,
      future: [],
    }));
    markChanged();
  }

  function undo() {
    if (!history.past.length || saving) return;
    const previous = history.past.at(-1)!;
    setHistory({
      past: history.past.slice(0, -1),
      present: previous,
      future: [history.present, ...history.future],
    });
    markChanged();
  }

  function redo() {
    if (!history.future.length || saving) return;
    const [next, ...future] = history.future;
    setHistory({ past: [...history.past, history.present], present: next, future });
    markChanged();
  }

  /**
   * Tiles currently occupied by people. While walking, they are between the tile they left and the tile they enter, so count both.
   * People keep walking while the editor is open; ignoring this would allow furniture to be placed on them.
   */
  function standingTiles() {
    const keys = new Set<string>();
    for (const motion of motionsRef.current.values()) {
      keys.add(`${motion.point.col},${motion.point.row}`);
      keys.add(`${motion.from.col},${motion.from.row}`);
    }
    return keys;
  }

  /** A new piece of the given type, centered on a tile. */
  function pieceAt(type: OfficeFurnitureType, point: OfficePoint, uid: string): OfficeFurniture {
    const size = furnitureFootprint(type, 0);
    return {
      uid,
      type,
      col: point.col - Math.floor(size.cols / 2),
      row: point.row - Math.floor(size.rows / 2),
      rotation: 0,
      hue: 0,
    };
  }

  function placeFurniture(type: OfficeFurnitureType, point: OfficePoint) {
    if (saving) return;
    const item = nearestFurniturePlacement(layout, pieceAt(type, point, newFurnitureUid()), standingTiles());
    if (!item) {
      setSaveState("layout.blockedPlacement");
      return;
    }
    commitLayout({ ...layout, furniture: [...layout.furniture, item] });
    setSelectedUid(item.uid);
    setPlacingType(null);
    clearGhost();
  }

  function clearGhost() {
    ghostTile.current = null;
    setGhost(null);
  }

  /** Show where the armed piece would land. Recomputed only when the pointer enters another tile. */
  function previewPlacement(event: ReactPointerEvent<HTMLDivElement>) {
    if (!placingType) return;
    const point = eventPoint(event.currentTarget, event.clientX, event.clientY);
    if (ghostTile.current && samePoint(ghostTile.current, point)) return;
    ghostTile.current = point;
    const wanted = pieceAt(placingType, point, "placement-preview");
    const spot = nearestFurniturePlacement(layout, wanted, standingTiles());
    setGhost(spot ? { item: spot, valid: true } : { item: wanted, valid: false });
  }

  function updateSelected(update: Partial<OfficeFurniture>) {
    if (!selected || saving) return;
    const next = { ...selected, ...update };
    if (!canPlaceFurniture(layout, next, selected.uid, standingTiles())) {
      setSaveState("layout.blockedOverlap");
      return;
    }
    commitLayout({
      ...layout,
      furniture: layout.furniture.map((item) => item.uid === selected.uid ? next : item),
    });
  }

  function handleWorldClick(event: MouseEvent<HTMLDivElement>) {
    if (!editorOpen) {
      setSelectedAgentId(null);
      return;
    }
    if (!placingType) return;
    placeFurniture(placingType, eventPoint(event.currentTarget, event.clientX, event.clientY));
  }

  function handleCameraPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!canPan || event.button !== 0 || (event.target as Element).closest("button")) return;
    panStart.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      panX: visibleCameraPan.x,
      panY: visibleCameraPan.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCameraPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    previewPlacement(event);
    const start = panStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    // Accumulating values that never reach the screen creates a dead segment when direction reverses.
    const { width, height } = stageSize.current;
    const baseX = (0.5 - camTarget.current.x) * cameraScale * width;
    const baseY = (0.5 - camTarget.current.y) * cameraScale * height;
    const limitX = Math.max(0, ((cameraScale - 1) / 2) * width);
    const limitY = Math.max(0, ((cameraScale - 1) / 2) * height);
    setCameraPan({
      x: clamp(start.panX + event.clientX - start.x + baseX, limitX) - baseX,
      y: clamp(start.panY + event.clientY - start.y + baseY, limitY) - baseY,
      room: activeRoom,
    });
  }

  function finishCameraPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (panStart.current?.pointerId !== event.pointerId) return;
    panStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleWorldKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!editorOpen || !placingType || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    const point = firstAvailableFurnitureCenter(layout, placingType, standingTiles());
    if (point) placeFurniture(placingType, point);
    else setSaveState("layout.noRoom");
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!editorOpen || saving) return;
    const uid = event.dataTransfer.getData("text/plain");
    const point = eventPoint(event.currentTarget, event.clientX, event.clientY);
    // A piece dragged straight out of the catalog.
    const fresh = FURNITURE_CATALOG.find(({ type }) => `${NEW_PIECE}${type}` === uid);
    if (fresh) {
      placeFurniture(fresh.type, point);
      return;
    }
    const item = layout.furniture.find((entry) => entry.uid === uid);
    if (!item) return;
    const size = furnitureFootprint(item.type, item.rotation);
    setSelectedUid(uid);
    const moved = nearestFurniturePlacement(
      layout,
      { ...item, col: point.col - Math.floor(size.cols / 2), row: point.row - Math.floor(size.rows / 2) },
      standingTiles(),
      item.uid,
    );
    if (!moved) {
      setSaveState("layout.blockedOverlap");
      return;
    }
    commitLayout({
      ...layout,
      furniture: layout.furniture.map((entry) => entry.uid === uid ? moved : entry),
    });
  }

  /** Saving changes the office for every visitor, so the server only accepts it from a signed-in admin. */
  async function saveLayout() {
    if (saving) return;
    const token = adminToken();
    if (!token) {
      setSaveState("layout.needAdmin");
      return;
    }
    const revision = editRevision.current;
    setSaving(true);
    setSaveState("layout.saving");
    let status = 0;
    try {
      const response = await fetch("/api/admin/layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ layout }),
      });
      status = response.status;
    } catch {
      // No answer at all; reported as a failed save below.
    }
    setSaving(false);
    if (status === 200) {
      // Edits made while the request was in flight are not in what was saved.
      const stale = editRevision.current !== revision;
      unsaved.current = stale;
      setSaveState(stale ? "layout.savedStale" : "layout.saved");
    } else if (status === 401) {
      storeAdminToken(null);
      setSaveState("layout.needAdmin");
    } else {
      setSaveState("layout.saveFailed");
    }
  }

  const rootStyle = {
    "--office-floor": theme.floor,
    "--office-wall": theme.wall,
    "--office-wall-dark": theme.wallDark,
    "--office-trim": theme.trim,
    "--office-rug": theme.rug,
    "--office-carpet": theme.carpet,
    "--office-accent": theme.accent,
    "--office-glow": theme.glow,
    "--office-surface": theme.surface,
    "--office-ink": theme.ink,
    "--office-floor-asset": `url("${theme.floorAsset}")`,
    "--office-wall-asset": `url("${theme.wallAsset}")`,
    "--office-carpet-asset": `url("${theme.carpetAsset}")`,
    "--office-grid-x": `${100 / OFFICE_COLS}%`,
    "--office-grid-y": `${100 / OFFICE_ROWS}%`,
  } as WorldStyle;

  /*
   * The editor panel. The shell gives it a place beside the floor (`editorHost`); without one it is laid
   * over the floor's right edge, which hides the rooms underneath.
   */
  const editorPanel = editorOpen ? (
      <aside className="office-editor" id="office-editor" aria-labelledby="office-editor-title">
        <div className="office-editor-heading">
          <div>
            <p>{t(locale, "editor.kicker")}</p>
            <h3 id="office-editor-title">{t(locale, "editor.title")}</h3>
          </div>
          {/*
            * Unless active furniture placement is also disabled, the stage keeps announcing "Select a location for the furniture."
           */}
          <button
            type="button"
            onClick={() => { setEditorOpen(false); setPlacingType(null); }}
            aria-label={t(locale, "editor.close")}
          >×</button>
        </div>
        {/* Directly under the heading and pinned there: at the bottom it scrolled out of view and refusals went unseen. */}
        <p className="office-save-status" role="status" aria-live="polite">{t(locale, saveState)}</p>

        <fieldset className="office-editor-section" disabled={saving}>
          <legend>{t(locale, "editor.themeLegend")}</legend>
          <div className="office-theme-options">
            {(Object.keys(OFFICE_THEMES) as OfficeTheme[]).map((key) => (
              <button
                type="button"
                key={key}
                className={layout.theme === key ? "selected" : ""}
                aria-pressed={layout.theme === key}
                style={{ "--theme-swatch": OFFICE_THEMES[key].accent } as WorldStyle}
                onClick={() => commitLayout({ ...layout, theme: key })}
              >
                {localized(OFFICE_THEMES[key].label, locale)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="office-editor-section" disabled={saving}>
          <legend>{t(locale, "editor.catalogLegend")}</legend>
          <p>{t(locale, "editor.catalogNote")}</p>
          <div className="office-furniture-catalog">
            {FURNITURE_CATALOG.map((item) => (
              <button
                type="button"
                key={item.type}
                className={placingType === item.type ? "selected" : ""}
                aria-pressed={placingType === item.type}
                draggable={!saving}
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", `${NEW_PIECE}${item.type}`);
                  event.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => {
                  setPlacingType((current) => current === item.type ? null : item.type);
                  setSelectedUid(null);
                }}
              >
                <i aria-hidden="true" style={{ backgroundImage: `url("${item.asset}")` }} />
                <span>{localized(item.label, locale)}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {selected ? (
          <fieldset className="office-editor-section" disabled={saving}>
            <legend>{t(locale, "editor.selectedLegend")}</legend>
            <div className="office-editor-controls" aria-label={t(locale, "editor.moveGroup")}>
              <button type="button" onClick={() => updateSelected({ row: selected.row - 1 })} aria-label={t(locale, "editor.moveUp")}>↑</button>
              <button type="button" onClick={() => updateSelected({ col: selected.col - 1 })} aria-label={t(locale, "editor.moveLeft")}>←</button>
              <button type="button" onClick={() => updateSelected({ row: selected.row + 1 })} aria-label={t(locale, "editor.moveDown")}>↓</button>
              <button type="button" onClick={() => updateSelected({ col: selected.col + 1 })} aria-label={t(locale, "editor.moveRight")}>→</button>
              {FURNITURE_CATALOG.find(({ type }) => type === selected.type)?.rotatable ? (
                <button
                  type="button"
                  onClick={() => updateSelected({ rotation: ((selected.rotation + 90) % 360) as FurnitureRotation })}
                >
                  {t(locale, "editor.rotate")}
                </button>
              ) : null}
            </div>
            <div className="office-hue-options" aria-label={t(locale, "editor.hueGroup")}>
              {HUES.map(({ value, label }) => (
                <button
                  type="button"
                  key={value}
                  className={selected.hue === value ? "selected" : ""}
                  aria-label={t(locale, label)}
                  aria-pressed={selected.hue === value}
                  style={{ "--furniture-hue": `${value}deg`, "--hue": `${value}deg` } as WorldStyle}
                  onClick={() => updateSelected({ hue: value })}
                />
              ))}
            </div>
            <button
              type="button"
              className="office-delete-furniture"
              onClick={() => {
                commitLayout({ ...layout, furniture: layout.furniture.filter(({ uid }) => uid !== selected.uid) });
                setSelectedUid(null);
              }}
            >
              {t(locale, "editor.delete")}
            </button>
          </fieldset>
        ) : null}

        <div className="office-editor-footer">
          <div>
            <button type="button" disabled={!history.past.length || saving} onClick={undo}>{t(locale, "editor.undo")}</button>
            <button type="button" disabled={!history.future.length || saving} onClick={redo}>{t(locale, "editor.redo")}</button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                commitLayout(DEFAULT_OFFICE_LAYOUT);
                setSelectedUid(null);
                setPlacingType(null);
              }}
            >
              {t(locale, "editor.reset")}
            </button>
          </div>
          <button type="button" className="office-save-layout" disabled={saving} onClick={() => void saveLayout()}>
            {t(locale, saving ? "editor.savingShort" : "editor.save")}
          </button>
        </div>
      </aside>
    ) : null;

  return (
    <section
      className={`office-world theme-${layout.theme} camera-${cameraView}${lively ? " workflow-running" : ""}${ready ? " office-ready" : ""}${editorOpen ? " editor-open" : ""}${crowded ? " office-crowded" : ""}`}
      style={rootStyle}
      aria-labelledby="office-world-title"
    >
      <header className="office-world-heading">
        <div>
          <p>{localized(COPY.officeKicker, locale)}</p>
          <h3 id="office-world-title">{localized(COPY.officeTitle, locale)}</h3>
          <span>{fill(COPY.officeSummary, locale, { count: members.length, voice: voiceCount, chat: chatCount })}</span>
        </div>
        <div className="office-world-heading-tools">
          <div className="office-clock-card">
            <span>{clock.label}</span>
            <time dateTime={clock.time}>{clock.time}</time>
          </div>
          <div className="office-world-actions">
            <span className={`status-badge status-${lively ? "running" : "idle"}`} role="status">
              {localized(lively ? COPY.badgeLive : COPY.badgeQuiet, locale)}
            </span>
            <button
              type="button"
              className="office-editor-toggle"
              aria-expanded={editorOpen}
              aria-controls="office-editor"
              onClick={() => {
                setEditorOpen((open) => !open);
                setPlacingType(null);
                setSelectedAgentId(null);
                setCameraView("full");
                setCameraPan({ x: 0, y: 0, room: activeRoom });
              }}
            >
              {t(locale, editorOpen ? "office.editorClose" : "office.editorOpen")}
            </button>
          </div>
        </div>
      </header>

      <div className="office-world-body">
        <div
          className={`office-world-stage${editorOpen ? " editing" : ""}${placingType ? " placing" : ""}${canPan ? " camera-pannable" : ""}`}
          data-editing={editorOpen ? "true" : "false"}
          data-camera-view={cameraClose ? "close" : "full"}
          ref={stageEl}
          style={{ aspectRatio: `${OFFICE_COLS} / ${OFFICE_ROWS}` }}
          role="group"
          aria-label={placingType
            ? t(locale, "office.placePrompt")
            : t(locale, cameraClose ? "office.stageClose" : "office.stage")}
          tabIndex={placingType ? 0 : undefined}
          onClick={handleWorldClick}
          onKeyDown={handleWorldKeyDown}
          onPointerDown={handleCameraPointerDown}
          onPointerMove={handleCameraPointerMove}
          onPointerUp={finishCameraPan}
          onPointerCancel={finishCameraPan}
          onPointerLeave={clearGhost}
          onDragOver={(event) => { if (editorOpen) event.preventDefault(); }}
          onDrop={handleDrop}
        >
          <div className="office-world-camera" ref={cameraEl} data-compact="false">
          <i
            className="office-elevator"
            aria-hidden="true"
            style={rectStyle(ELEVATOR_SHAFT.col, ELEVATOR_SHAFT.row, ELEVATOR_SHAFT.cols, ELEVATOR_SHAFT.rows)}
          />
          <div className="office-zone-layer">
            {ROOM_ZONES.map((zone, index) => {
              const room = rooms[index];
              const title = roomTitle(room, index, locale);
              // People the server left out plus people this room has no chair for.
              const hidden = (room?.overflow ?? 0) + (unseated[index] ?? 0);
              const note = `${roomNote(room, locale)}${hidden ? ` · ${fill(COPY.roomOverflow, locale, { count: hidden })}` : ""}`;
              return (
                <article
                  className={`office-zone ${index >= WORKSPACE_ZONES.length ? "amenity-zone " : ""}zone-${zone.id}`}
                  key={zone.id}
                  style={{ ...rectStyle(zone.col, zone.row, zone.cols, zone.rows), "--zone-accent": zone.accent } as WorldStyle}
                  aria-label={`${title}${room?.subtitle ? `, ${room.subtitle}` : ""}, ${note}`}
                  aria-current={activeRoom === index ? "step" : undefined}
                  data-zone-status={room?.live ? "running" : "idle"}
                  data-bound={room && room.kind !== "none" && !room.missing ? "true" : "false"}
                >
                  <div className="office-zone-heading">
                    <span>{zone.code}</span>
                    <div>
                      <strong>{title}</strong>
                      <small>{note}</small>
                    </div>
                  </div>
                  <i
                    className={`office-zone-door door-${doorDirection(zone)}`}
                    style={{
                      "--door-x": `${Math.max(0, Math.min(100, ((zone.door.col - zone.col) / zone.cols) * 100))}%`,
                      "--door-y": `${Math.max(0, Math.min(100, ((zone.door.row - zone.row) / zone.rows) * 100))}%`,
                    } as WorldStyle}
                    aria-hidden="true"
                  />
                </article>
              );
            })}
          </div>

          <div className="office-furniture-layer" aria-label={t(locale, "office.furnitureLayer")}>
            {layout.furniture.map((item) => {
              const catalogItem = FURNITURE_CATALOG.find(({ type }) => type === item.type);
              const size = furnitureFootprint(item.type, item.rotation);
              return (
                <button
                  type="button"
                  className={`office-furniture furniture-${item.type}${selectedUid === item.uid ? " furniture-selected" : ""}`}
                  key={item.uid}
                  style={{
                    ...rectStyle(item.col, item.row, size.cols, size.rows),
                    "--furniture-asset": `url("${catalogItem?.asset ?? ""}")`,
                    "--furniture-hue": `${item.hue}deg`,
                    "--furniture-rotation": `${item.rotation}deg`,
                    "--world-row": item.row,
                  } as WorldStyle}
                  aria-label={`${catalogItem ? localized(catalogItem.label, locale) : item.type}${selectedUid === item.uid ? t(locale, "office.furnitureSelected") : ""}`}
                  aria-pressed={selectedUid === item.uid}
                  disabled={!editorOpen}
                  draggable={editorOpen && !saving}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedUid(item.uid);
                    setPlacingType(null);
                  }}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", item.uid);
                    event.dataTransfer.effectAllowed = "move";
                    setSelectedUid(item.uid);
                  }}
                >
                  <span className="office-furniture-sprite" aria-hidden="true" />
                </button>
              );
            })}
          </div>

          {placingType && ghost?.item.type === placingType ? (
            <i
              aria-hidden="true"
              className="office-placement-ghost"
              data-valid={ghost.valid ? "true" : "false"}
              style={rectStyle(ghost.item.col, ghost.item.row, furnitureFootprint(ghost.item).cols, furnitureFootprint(ghost.item).rows)}
            />
          ) : null}

          <ul className="office-agent-layer" aria-label={t(locale, "office.agentLayer", { count: actors.length })}>
            {actors.map((actor) => {
              const title = roomTitle(rooms[actor.room], actor.room, locale);
              const presence = localized(PRESENCE_LABELS[actor.presence], locale);
              const activity = activityText(actor, locale);
              const doing = doingText(actor, locale);
              const voice = voiceText(actor, locale);
              const selectedAgent = visibleSelectedAgentId === actor.id;
              const popoverId = `office-agent-${actor.id}`;
              return (
                <li
                  className={`world-agent agent-support${selectedAgent ? " agent-selected" : ""}${actor.look ? "" : ` sprite-${actor.sprite}`}`}
                  key={actor.id}
                  ref={(el) => {
                    if (el) agentEls.current.set(actor.id, el);
                    else agentEls.current.delete(actor.id);
                  }}
                  // The tint belongs to the fallback sprites; an assembled character already has its own colors.
                  style={{ "--agent-hue": actor.look ? "0deg" : `${actor.hue}deg` } as WorldStyle}
                  data-presence={actor.presence}
                >
                  <b
                    className="world-agent-bubble"
                    data-on={actor.chat || actor.typing ? "true" : "false"}
                    data-tone={actor.chat ? "talk" : "think"}
                    aria-hidden="true"
                  >
                    {actor.chat
                      ? fill(COPY.activityChat, locale, { where: actor.chat })
                      : actor.typing ? `${fill(COPY.activityTyping, locale, { where: actor.typing })}…` : ""}
                  </b>
                  {/* Keyed by id so each new reaction or emote restarts the float-up animation, which also takes it out of view. */}
                  {actor.reaction ? (
                    <i className="world-agent-reaction" key={`r${actor.reaction.id}`} aria-hidden="true">
                      {actor.reaction.image ? <img alt="" src={actor.reaction.image} /> : actor.reaction.text}
                    </i>
                  ) : null}
                  {actor.emote ? (
                    <i className="world-agent-reaction" key={`e${actor.emote.id}`} aria-hidden="true">{EMOTE_GLYPHS[actor.emote.kind]}</i>
                  ) : null}
                  <button
                    type="button"
                    className="world-agent-select"
                    aria-label={fill(COPY.agentSummary, locale, { name: actor.name, presence, room: title, activity })
                      + (typeof actor.level === "number" ? `, ${fill(COPY.levelBadge, locale, { level: actor.level })}` : "")}
                    aria-expanded={selectedAgent}
                    aria-controls={selectedAgent ? popoverId : undefined}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedAgentId((current) => current === actor.id ? null : actor.id);
                    }}
                  />
                  <span
                    className="world-agent-sprite"
                    aria-hidden="true"
                    style={actor.look ? { backgroundImage: `url("/api/character/${actor.look}.png")` } : undefined}
                  />
                  {actor.avatar ? (
                    <img alt="" className="world-agent-face" draggable={false} src={`/api/avatar/${actor.id}?v=${actor.avatar}`} />
                  ) : null}
                  <span className="world-agent-identity">
                    {typeof actor.level === "number" ? <em className="world-agent-level">{actor.level}</em> : null}
                    {/* The plate is narrow: it carries the game or app's name alone; the roster and the popover say the rest. */}
                    {actor.activity ? <small title={doing ?? undefined}>{actor.activity.name}</small> : null}
                    <strong>{actor.name}</strong>
                  </span>
                  {voice ? <b className="world-agent-status">{fill(COPY.voiceBadge, locale, { where: voice })}</b> : null}
                  {selectedAgent ? (
                    <aside
                      className="world-agent-popover"
                      id={popoverId}
                      aria-label={t(locale, "office.agentInfo", { name: actor.name })}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <strong>{actor.name}</strong>
                      <span>{presence}</span>
                      <dl>
                        <div>
                          <dt>{localized(COPY.agentRoom, locale)}</dt>
                          <dd>{title}</dd>
                        </div>
                        <div>
                          <dt>{localized(COPY.agentNow, locale)}</dt>
                          <dd>{activity}</dd>
                        </div>
                        {typeof actor.level === "number" ? (
                          <div>
                            <dt>{localized(COPY.agentLevel, locale)}</dt>
                            <dd>{actor.level}</dd>
                          </div>
                        ) : null}
                      </dl>
                      <button type="button" onClick={() => setSelectedAgentId(null)} aria-label={t(locale, "office.agentClose")}>×</button>
                    </aside>
                  ) : null}
                </li>
              );
            })}
          </ul>
          </div>
          {/*
            * Full-screen staging removes the surrounding UI. Camera controls must overlay the stage to remain available in that mode.
            * Hide them only while the editor is open — otherwise they conflict with furniture-placement clicks.
           */}
          {editorOpen ? null : (
            <div className="office-camera-controls" role="group" aria-label={t(locale, "office.cameraGroup")}>
              <button
                type="button"
                className="office-camera-toggle"
                aria-pressed={cameraView === "full"}
                onClick={() => {
                  setCameraView("full");
                  setCameraPan({ x: 0, y: 0, room: activeRoom });
                }}
              >
                {t(locale, "office.cameraFull")}
              </button>
              <button
                type="button"
                className="office-camera-toggle"
                aria-pressed={cameraView === "close"}
                onClick={() => {
                  setCameraView("close");
                  setCameraPan({ x: 0, y: 0, room: activeRoom });
                }}
              >
                {t(locale, "office.cameraClose")}
              </button>
              <button
                type="button"
                className="office-camera-toggle"
                aria-pressed={follow}
                disabled={!cameraClose}
                title={cameraClose ? undefined : t(locale, "office.cameraFollowHint")}
                onClick={() => setFollow((on) => !on)}
              >
                {t(locale, "office.cameraFollow")}
              </button>
            </div>
          )}
          {
            // The same guidance is already in the stage's aria-label (office.stageClose), so it is redundant for assistive technology.
            canPan ? <p className="office-drag-hint" aria-hidden="true">{t(locale, "office.dragHint")}</p> : null
          }
          {placingType ? <p className="office-drag-hint" aria-hidden="true">{t(locale, "office.placePrompt")}</p> : null}
          {reducedMotion ? <p className="office-motion-note" role="status">{t(locale, "office.reducedMotion")}</p> : null}
        </div>

        <section className="office-lobby" aria-label={t(locale, "office.lobby")}>
          <div className="lobby-reception">
            <strong>RECEPTION</strong>
            <span>{t(locale, "office.reception")}</span>
          </div>
          <div className="lobby-entrance">
            <strong>{layout.officeName}</strong>
            <span>MAIN ENTRANCE</span>
          </div>
          <div className="lobby-elevators">
            <strong>ELEVATOR</strong>
            <i aria-hidden="true" />
            <i aria-hidden="true" />
          </div>
        </section>

        {editorHost ? createPortal(editorPanel, editorHost) : editorPanel}
      </div>
    </section>
  );
}

export default OfficeWorld;
