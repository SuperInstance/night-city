// bridge.ts — QuiltBridge: the night city speaks quilt without its files
// being touched. Every game act arrives from OUTSIDE; Cyrus Mobini's
// modules stay byte-identical. The pane toggles and you watch the
// substrate run while you play: every easter egg, walk, and frame as
// chain cells.
//
// The bridge is framework-agnostic: src/quilt/bootstrap.ts feeds it the
// real zustand stores at boot; tests feed it fakes. Neither touches the
// game source.

import { Kernel, type Opcode, type QuiltCell } from './kernel.js';

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface ZustandLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getState(): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setState(partial: any): void;
}

export interface BridgeOptions {
  convId?: string;
  tickEvery?: number;
  keep?: number;
  now?: () => number;
  visitMinDistance?: number;
  visitMinIntervalMs?: number;
}

// Map of audio path (suffix) → easter-egg id. Discovery MUST land as
// EFFECT {kind: "easter-egg", id} — the game's secrets become canon rows.
export const EASTER_EGG_SOUNDS: Record<string, string> = {
  'unobtanium.wav': 'unobtanium',
  'finished.wav': 'true-fan',
};

export function wrapZustandAction(
  store: ZustandLike,
  key: string,
  before: (...args: unknown[]) => void
): (...args: unknown[]) => unknown {
  // Wrap a zustand store action from OUTSIDE: the original runs, in its
  // original position, and the chain cell is announced first.
  const state = store.getState();
  const orig = state[key] as (...args: unknown[]) => unknown;
  if (typeof orig !== 'function') throw new Error(`not an action: ${key}`);
  const wrapped = (...args: unknown[]) => {
    before(...args);
    return orig(...args);
  };
  store.setState({ [key]: wrapped });
  return orig;
}

export class QuiltBridge {
  kernel: Kernel;
  tickEvery: number;
  keep: number;
  frame: number;
  private now: () => number;
  private visitMinDistance: number;
  private visitMinIntervalMs: number;
  private lastVisitPos: Vec3Like | null = null;
  private lastVisitAt = 0;
  private visitedTerritories = new Set<string>();
  private announcedEggs = new Set<string>();
  private sceneAnnounced = false;
  private listeners = new Set<(cell: QuiltCell) => void>();

  constructor({
    convId = 'night-city',
    tickEvery = 30,
    keep = 500,
    now = () => Date.now(),
    visitMinDistance = 4,
    visitMinIntervalMs = 2000,
  }: BridgeOptions = {}) {
    this.kernel = new Kernel(convId);
    this.tickEvery = tickEvery;
    this.keep = keep;
    this.frame = 0;
    this.now = now;
    this.visitMinDistance = visitMinDistance;
    this.visitMinIntervalMs = visitMinIntervalMs;
  }

  onCell(fn: (cell: QuiltCell) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(op: Opcode, payload: Record<string, unknown> = {}): QuiltCell {
    const cell = this.kernel.emit(op, payload);
    for (const fn of this.listeners) fn(cell);
    return cell;
  }

  sceneLoaded(sceneName: string, props: string[] = []): number {
    // The city model parsed and entered the rapier world — the scene is
    // (re)presented, its clickable props come into being.
    if (this.sceneAnnounced) return this.kernel.cells.length;
    this.sceneAnnounced = true;
    this.emit('VIEW', { scene: sceneName, props: props.length });
    for (const name of props) {
      this.emit('BIND', { kind: 'prop', name });
    }
    this.emit('LINK', { kind: 'scene-graph', scene: sceneName, props: props.length });
    this.emit('TICK', { phase: 'scene-built', props: props.length });
    return this.kernel.cells.length;
  }

  playerMoved(pos: Vec3Like): QuiltCell | null {
    // Throttled LINK {kind:"visit"}: the upstream store already gates
    // updates at POSITION_DISPLACEMENT_THRESHOLD; we additionally require
    // 4 units of travel or 2 s of dwell so a wiggle isn't a parade.
    const t = this.now();
    if (this.lastVisitPos) {
      const dx = pos.x - this.lastVisitPos.x;
      const dz = pos.z - this.lastVisitPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < this.visitMinDistance && t - this.lastVisitAt < this.visitMinIntervalMs) {
        return null;
      }
    }
    this.lastVisitPos = { x: pos.x, y: pos.y, z: pos.z };
    this.lastVisitAt = t;
    return this.emit('LINK', {
      kind: 'visit',
      x: +pos.x.toFixed(2),
      y: +pos.y.toFixed(2),
      z: +pos.z.toFixed(2),
    });
  }

  territoryEntered(name: string): QuiltCell | null {
    const key = String(name);
    if (!key || this.visitedTerritories.has(key)) return null;
    this.visitedTerritories.add(key);
    return this.emit('EFFECT', { kind: 'territory', name: key });
  }

  soundPlayed(path: string): QuiltCell | null {
    // Guy's voice-overs are the game's discovery channel: territory
    // audios, the welcome, and — the two real easter eggs — the
    // unobtanium pickup and the 100% true-fan fanfare.
    const file = String(path).split('/').pop() || '';
    const eggId = EASTER_EGG_SOUNDS[file];
    if (eggId) {
      if (this.announcedEggs.has(eggId)) return null;
      this.announcedEggs.add(eggId);
      return this.emit('EFFECT', { kind: 'easter-egg', id: eggId });
    }
    return this.emit('EFFECT', { kind: 'audio', id: file });
  }

  pageVisited(page: string): QuiltCell | null {
    const p = String(page || '/');
    return this.emit('LINK', { kind: 'visit', page: p });
  }

  tick(): QuiltCell | null {
    this.frame++;
    if (this.frame % this.tickEvery !== 0) return null;
    const cell = this.emit('TICK', { frame: this.frame });
    this.kernel.forget(this.keep);
    return cell;
  }

  stats() {
    return {
      frames: this.frame,
      cells: this.kernel.cells.length,
      coherence: +this.kernel.coherence().toFixed(4),
      counters: this.kernel.counters(),
      head: this.kernel.lastHash.slice(0, 12),
    };
  }
}
