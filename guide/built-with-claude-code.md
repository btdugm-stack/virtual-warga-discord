# How This Was Built with Claude Code (Making-of)

This pixel office was built with people setting the direction and **Claude Code writing the code**. This is not
a step-by-step tutorial; it records the working practices we actually followed.

## 1. Start by Centralizing Configuration

We put identity-defining values such as the product name, colors, and workspace names in one file:
`company.config.ts`. As a result, an instruction such as "change the purple room to green" requires editing only
one file and produces a smaller diff for human review. Tests fail if colors are hardcoded in CSS, keeping this
rule intact.

## 2. Code Is the Source of Truth for the World

The 72×30 office floor plan, walls, doors, seats, and protected paths are defined as data in `office-world.ts`,
not in an image file. When the AI carries out a request such as "make the dining room two tiles wider,"
pathfinding and seat assignment read the same data, so the visuals and behavior cannot drift apart.

## 3. Document the Rules Against Fake Behavior

We wrote "do not add timer-driven progress, fixed dialogue, or fake completion results" into the project rules
and made the AI read those rules before every task. When a demo or staged presentation is necessary, it is
isolated in a separate mode so it cannot leak into the real interface.

## 4. Verify by Measurement—Measure What Needs Fixing, Not What Was Fixed

Five verification failures occurred during development, all for the same reason: we measured something, but
**chose the wrong thing to measure**—a different element, only one axis, or a point too early in time. Since then,
we have measured the element, axis, and timing separately during screen verification. We also open the script to
confirm which checks a green "tests passed" indicator actually ran.

## 5. Prompt Pattern Used in Practice

```text
Objective: (one sentence)
Current state: (in terms of files and behavior)
Definition of done: (what it must look like or how it must behave to count as complete)
Do not: (files and rules that must not be touched)
Verification: (what to run before declaring completion)
```

When an instruction includes these five lines, the AI's output becomes noticeably more reliable. By contrast,
"make it look good" was a classic example of an instruction that led to rework.

## 6. What People Do

Set direction, prioritize, approve, and **stay skeptical**. Even when the AI says "done," the work is not complete
until someone runs it. This repository's demo works in a browser because a person launched and verified it before
every push.
