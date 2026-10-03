# Color Palette — 19 Color Tokens

Every screen color comes from the single `THEME` definition in `src/company.config.ts`. Colors are not
hardcoded in CSS; `themeStyle` in `src/App.tsx` injects them at runtime as `--color-*` CSS variables.
Changing one color updates the entire app.

Design intent: place a **warm cream office** inside a **dark charcoal-and-navy product frame**, making the
pixel space appear like a stage floating within the screen.

| Token | Value | Use |
|---|---|---|
| `app` | `#0b1722` | Outer product frame (darkest background) |
| `frame` | `#fffaf0` | Light text and borders on the dark frame |
| `panel` | `#eef7f3` | Panel background |
| `surface` | `#dff1ec` | Recessed surface within a panel |
| `line` | `#afc9c1` | Dividers and borders |
| `edge` | `#315f70` | Emphasized borders |
| `floor` | `#fff0cd` | Warm office floor tone |
| `cream` | `#fffdf5` | Brightest surface |
| `ink` | `#102b38` | Body text |
| `muted` | `#4a6872` | Secondary text |
| `skin` | `#e0ab84` | Default character skin tone |
| `wood` | `#b66f3e` | Furniture wood |
| `woodDark` | `#694229` | Furniture wood shading |
| `screen` | `#164761` | Monitor screens |
| `green` | `#55c985` | Success and completion |
| `amber` | `#f3ad32` | Progress and caution |
| `red` | `#c63c47` | Failure and errors |
| `focus` | `#176bc1` | Focus ring |
| `shadow` | `#05131c` | Shadows |

Room accent colors are defined on each workspace (`WORKSPACES[n].accent`) rather than as tokens —
Planning `#f6b73c`, Analysis `#58b9e8`, Design `#ef71b4`, Implementation `#aa8cf2`,
and Monitoring `#4fc484`.
