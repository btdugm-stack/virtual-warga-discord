/**
 * The shared furniture layout's shape checks (`server/layout-store.mjs`): junk must not get into the file, and
 * a saved layout must come back identically after a restart.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { LayoutStore, checkedLayout } from "../layout-store.mjs";

const valid = () => ({
  version: 4,
  officeName: "Kantor Warga",
  theme: "warm",
  headcount: 20,
  furniture: [
    { uid: "meja1", type: "DESK", col: 2, row: 3, rotation: 0, hue: 0 },
    { uid: "kursi2", type: "CHAIR", col: 2, row: 4, rotation: 90, hue: 120 },
  ],
});

test("a well-formed layout passes as-is", () => {
  assert.deepEqual(checkedLayout(valid()), valid());
});

test("a layout missing any key is rejected whole", () => {
  for (const key of ["version", "officeName", "theme", "headcount", "furniture"]) {
    const layout = valid();
    delete layout[key];
    assert.throws(() => checkedLayout(layout), /Invalid layout/);
  }
  assert.throws(() => checkedLayout(null), /Invalid layout/);
  assert.throws(() => checkedLayout([]), /Invalid layout/);
});

test("an unknown version, theme, or headcount is rejected", () => {
  assert.throws(() => checkedLayout({ ...valid(), version: 3 }), /Invalid layout/);
  assert.throws(() => checkedLayout({ ...valid(), theme: "neon" }), /Invalid layout/);
  assert.throws(() => checkedLayout({ ...valid(), headcount: 0 }), /Invalid layout/);
  assert.throws(() => checkedLayout({ ...valid(), headcount: 101 }), /Invalid layout/);
  assert.throws(() => checkedLayout({ ...valid(), officeName: "" }), /Invalid layout/);
  assert.throws(() => checkedLayout({ ...valid(), officeName: "x".repeat(33) }), /Invalid layout/);
});

test("furniture beyond the cap is rejected", () => {
  const layout = valid();
  layout.furniture = Array.from({ length: 241 }, (_, index) => ({ uid: `f${index}`, type: "DESK", col: 1, row: 1, rotation: 0, hue: 0 }));
  assert.throws(() => checkedLayout(layout), /Invalid layout/);
});

test("a malformed piece of furniture is rejected", () => {
  const cases = [
    { uid: "spaces here", type: "DESK", col: 1, row: 1, rotation: 0, hue: 0 },
    { uid: "meja1", type: "desk", col: 1, row: 1, rotation: 0, hue: 0 },
    { uid: "meja1", type: "DESK", col: 72, row: 1, rotation: 0, hue: 0 },
    { uid: "meja1", type: "DESK", col: 1, row: -1, rotation: 0, hue: 0 },
    { uid: "meja1", type: "DESK", col: 1, row: 1, rotation: 45, hue: 0 },
    { uid: "meja1", type: "DESK", col: 1, row: 1, rotation: 0, hue: 500 },
  ];
  for (const furniture of cases) {
    assert.throws(() => checkedLayout({ ...valid(), furniture: [furniture] }), /Invalid furniture/);
  }
});

test("a saved layout survives a restart", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "warga-layout-"));
  const file = path.join(dir, "layout.json");

  try {
    const store = new LayoutStore(file);
    assert.equal(store.layout, null, "nothing saved yet");
    assert.equal(store.rev, 0);

    const layout = checkedLayout(valid());
    store.save(layout);
    assert.equal(store.rev, 1);

    const reloaded = new LayoutStore(file);
    assert.deepEqual(reloaded.layout, layout);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});