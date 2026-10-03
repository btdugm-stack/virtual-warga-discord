# Office Floor Plan — One Large 72×30-Tile Office

This is **one connected floor plan**, not a set of separate cards. Walls, open doors, and shared corridors
connect five workspaces and four amenity spaces. A shared lobby with an entrance, reception desk, and elevator
fills the remaining height below the floor plan. The complete definition in `src/game/office-world.ts` is the
single source of truth.

## Space Layout

| Area | Purpose |
|---|---|
| Planning · Analysis · Design · Implementation · Monitoring | The five SDLC workspaces, in reading order: three along the top band, two along the bottom. Each has its own furniture layout, orientation, and rug |
| Library · Café · Lounge · Dining Room | Amenity spaces with assigned seats for support staff |
| Shared lobby | Entrance, reception desk, and elevator |

## Seating and Movement Rules (Design Principles)

- Capacity is 5–35 people (20 by default). The five workspace leads and each workspace's first support staff
  member sit in the workrooms; everyone else sits in the amenity spaces.
- While idle, 20–40% of support staff stroll back and forth through the shared corridors—a key device for
  making the screen feel alive.
- When a task begins, strollers return to their seats at twice their normal speed (only while returning), and
  everyone displays a focus signal.
- A room is at work exactly while a work item in it is running, so several rooms can work at once. The room's
  lead moves to the desk seat for as long as that lasts. The rules live in `src/game/workflow.ts`.
- When an approval moves a work item to the next room, a document flies from one room's door to the other's.
- Tiles occupied by walls, doors, or furniture are blocked during pathfinding. Tiles in front of doors and along
  major routes are designated as **protected tiles**, so furniture cannot be placed there. This prevents layouts
  that block paths before they are saved.
- An exhaustive 40×40 reachability test guarantees that every seat retains a path to every door (in the original
  repository).

## Furniture Editing

Users can choose from three styles and 25 furniture types, then place, move, rotate, and recolor them. Changes
are saved locally (this demo uses web preview state instead of persistence). The editing UI is in
`src/OfficeWorld.tsx`.
