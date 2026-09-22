# QUILT-BACKEND.md — night-city

The second city×quilt port. The first was
[`SuperInstance/code-city`](../code-city) (MIT, plain Three.js); this one is
BSD-3-Clause, TypeScript + React Three Fiber. The kernel is the same; the
wrapping surface is different. This document is the diff.

## Architecture: wrap from outside, touch nothing

night-city is a React + zustand + rapier app. React components close over
their handlers, so method-interception (the code-city trick) doesn't apply.
What zustand gives us instead is better: **store actions are state**, and
state can be replaced at runtime.

```
src/main.tsx                +1 marked import, +1 call  (the ONLY upstream-file change)
src/quilt/bootstrap.ts      wires the bridge onto the live stores
src/quilt/kernel.ts         6-opcode hash-chained ledger (zero deps)
src/quilt/bridge.ts         framework-agnostic event → cell translation
src/quilt/pane.ts           ◈ toggle, phosphor-on-black
tests/quilt.test.ts         15 node --test cases
```

`wrapZustandAction(store, key, before)` swaps a store action for a wrapper
that announces the chain cell first and then calls the original, unchanged.
The creators' modules stay byte-identical; the integration is one import in
the entry file.

## Game surface → cells

| Hook | Where it fires | Cell |
|---|---|---|
| `useGlobal.setIsLoaded(true)` | city GLTF parsed, rapier world up | `VIEW` + `BIND {kind:"prop"}` ×12 + `LINK {kind:"scene-graph"}` + `TICK` |
| `useLocation.setLocation` | player displacement > 0.5 units | `LINK {kind:"visit", x,y,z}` (≥4 units or ≥2 s dwell) |
| `useLocation.subscribe(territoriesName)` | territory enter/exit set changes | `EFFECT {kind:"territory", name}` (dedup'd) |
| `useSound.playSound` | Guy's voice-overs | `EFFECT {kind:"audio", id}` — and for `unobtanium.wav` / `finished.wav`: `EFFECT {kind:"easter-egg", id}` |
| `history.pushState` / `popstate` | mailbox, credits, resume pages | `LINK {kind:"visit", page}` |
| `requestAnimationFrame` loop | every frame | `TICK` every 30th; `FORGET` honestly at 500 cells |

The twelve props come from reading `City.tsx`/`Experience.tsx` — mailbox,
coffee, GitHub/LinkedIn frames, the unobtanium, CyrusAI the robot, the
drone, the word blocks. Read-only knowledge; zero edits.

## The kernel (unchanged law)

- Six opcodes: `BIND LINK EFFECT VIEW TICK FORGET`.
- Chain: `cell_hash = fnv1a64(cell_id + JSON.stringify({op,payload}) + "[]" + prev_hash)`,
  formatted `0x` + 16 hex digits, genesis `0x0000000000000000`.
- Canary: `fnv1a64("café Δ 日本語") === 0x24a555471370b18dn` — numeric law.
- `witness()` emits `{conv_id, cell_id, tick, state_json, answers_json, prev_hash, cell_hash}`
  with `state_json = JSON.stringify({op, payload})`, `answers_json = "[]"` —
  the kev-harness JSONL shape, replayable by
  [`harness/replay.py`](https://github.com/SuperInstance/kev-substrate-competition/blob/main/harness/replay.py).

## Why FORGET is on the chain

Upstream's own stats persist discovery to localStorage — the game already
believes forgetting deserves a record. The kernel agrees: trimming history
past 500 cells emits a `FORGET {dropped, trimmed_total}` cell, so dormancy
is recorded, never silent. Coherence is recomputed locally over the retained
window; the harness replay is the real referee.

## Port notes (TypeScript ≠ the .mjs reference)

- `kernel.ts` is a straight port; BigInt canary literal must end in `n`.
- `bridge.ts` takes injected `now()` and throttle distances — the test suite
  drives time by hand.
- Tests compile via `tsconfig.test.json` to `.quilt-test/` and run under
  `node --test`. No loader, no framework, no `npm ci`.
