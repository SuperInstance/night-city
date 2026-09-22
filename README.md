<div align="center">

# night-city — quilt substrate edition

**A walkable cyberpunk website-game full of easter-eggs — now with the city running on a substrate you can watch.**

[![forked from](https://img.shields.io/badge/forked%20from-cyrus2281%2Fnight--city-blue)](https://github.com/cyrus2281/night-city)
[![License: BSD-3-Clause](https://img.shields.io/badge/license-BSD--3--Clause-blue.svg)](LICENSE)
[![tests](https://img.shields.io/badge/tests-15%2F15%20node--test-brightgreen)](tests/quilt.test.ts)

*Find an easter egg upstream and you've found a secret. Find one here and the ledger tells you which `EFFECT` cell fired for it.*

</div>

---

## Play it

```bash
npm install && npm run start    # vite dev server; walk in with WASD
```

Find the unobtanium. Hit every territory. Unlock the true-fan mail.
**Press `Q` (or the ◈ button) to open the substrate** and watch every act
become a cell while you play.

## The quilt backend (what this fork adds)

Upstream built the night. This fork runs it on the
[Cocapn Fleet](https://github.com/SuperInstance/SuperInstance)'s quilt kernel —
six opcodes, vendored minimal, zero dependencies:

| Game act | Cell |
|---|---|
| City model loaded into the world | `VIEW {scene: "night-city"}` + `BIND` per clickable prop |
| Player crosses the city | `LINK {kind: "visit", x, z}` — throttled by distance and dwell |
| Page visited (mailbox, credits, resume…) | `LINK {kind: "visit", page}` |
| Territory voice-over fires | `EFFECT {kind: "territory", name}` / `EFFECT {kind: "audio", id}` |
| **Unobtanium picked up** | `EFFECT {kind: "easter-egg", id: "unobtanium"}` |
| **100% true-fan fanfare** | `EFFECT {kind: "easter-egg", id: "true-fan"}` |
| Every 30th frame | `TICK {frame}` |
| History trimmed past 500 cells | `FORGET {dropped}` — dormancy is not costume either |

Every cell chains `prev_hash → cell_hash` (FNV-1a-64 over UTF-8 bytes, genesis
`0x0000000000000000`; the fleet canary `café Δ 日本語 → 0x24a555471370b18d`
verified numerically). The **◈ backend pane** streams the live tail, opcode
counters, chain length, and coherence. The **⤓ witness.jsonl** export emits
the chain in the exact shape consumed by
[`kev-substrate-competition`'s `harness/replay.py`](https://github.com/SuperInstance/kev-substrate-competition/blob/main/harness/replay.py)
— numbers without a chain are withdrawals, not submissions, and this toy
produces chains a referee can replay.

Full design notes: [QUILT-BACKEND.md](QUILT-BACKEND.md).

## Why easter-eggs want a ledger

An easter egg is a hidden `EFFECT` — the game knows you found it, but
upstream it evaporates into a boolean and a localStorage flag. On the
substrate, discovery is a cell chained into the run's history. Speedrunners
get a replayable record of what they found in what order; the developers'
in-jokes become canon rows; a hundred percent completion is no longer a
claim, it's a chain you can export and verify.

## Respect for the original

[Cyrus Mobini](https://github.com/cyrus2281) built night-city, and this fork
treats that as load-bearing fact:

- Everything under `src/experience/` (and the rest of the game source) is
  **byte-identical to upstream**. The bridge wraps the zustand stores from
  outside at runtime; `src/main.tsx` gains one clearly-marked import and one
  call. No creator module is ever edited.
- The BSD 3-Clause license ships intact, and the creator credit is guarded by
  a regression test.
- Upstream history and authorship are intact in git; the fork badge points home.
- If upstream wants the substrate, it's one PR — the kernel is vendored and
  zero-dependency.

## Tests & CI

```bash
npm test    # tsc (test config) + node --test, 15 tests, zero runtime deps
```

Canary byte law, genesis chaining, tamper → coherence drop, honest `FORGET`,
witness field-for-field harness interop with replay verification, wrapper
fidelity (originals still run, order intact), easter-egg cell law, visit
throttle, tick cadence, license + creator-credit guards. CI runs them on
every push to `main`/`quilt-backend` (`.github/workflows/quilt-test.yml`) —
zero `npm ci`, just the TypeScript compiler via npx and node's built-in
runner. The upstream Netlify deploy workflow is untouched.

## Ecosystem

- [`SuperInstance/SuperInstance`](https://github.com/SuperInstance/SuperInstance) — the profile; the boat that builds itself
- [`SuperInstance/code-city`](../code-city) — the reference city×quilt port (MIT)
- [`SuperInstance/synthcity`](../synthcity) — the third city (134 MB of procedural neon)
- [`SuperInstance/quilt-studio`](https://github.com/SuperInstance/quilt-studio) — the kernel's product face
- [`SuperInstance/kev-substrate-competition`](https://github.com/SuperInstance/kev-substrate-competition) — the referee that replays this toy's witness exports

---

*Upstream README preserved for reference: [cyrus2281/night-city](https://github.com/cyrus2281/night-city#readme).*
