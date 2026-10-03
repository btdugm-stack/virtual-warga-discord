# Screen Principles

These rules govern every product screen and also apply to the demo.

## Structure

```text
┌────────────────────────────────────────────────────┐
│ Product name · connection status · settings        │
├────────────────────────────────────────────────────┤
│ Input · available actions in the current state     │
├────────────────────────────────────────────────────┤
│ Five-stage workflow status strip                   │
├───────────────────────────────┬────────────────────┤
│ Connected top-down office     │ Output / work log  │
└───────────────────────────────┴────────────────────┘
```

## Principles

1. **No fake progress.** The status strip changes only in response to real events and shows no percentages or
   simulated clocks. This product has no timer-driven progress bars.
2. **Show only state-appropriate actions.** Run, approve, and save buttons are enabled only when those actions
   are actually available.
3. **Dark frame, warm stage.** The charcoal frame (`--color-app`) surrounds the cream office
   (`--color-floor`), drawing attention to the office.
4. **Keep errors quiet.** Show a single small warning line below the status strip only when an error exists—no
   separate dashboard or meaningless metric cards.
5. **Use one breakpoint for the pane layout.** At 1180px and below, show the office, output, and work log one at
   a time in tabs.
6. **Accessibility.** When `prefers-reduced-motion` is enabled, retain a static focus indicator instead of large
   movements. The demo behaves the same way.
