// kernel.ts — the quilt 6-opcode kernel, vendored minimal for night-city.
// TypeScript port of SuperInstance/code-city's app/quilt/kernel.mjs (MIT).
//
// BIND   entity comes into being (prop, district, character)
// LINK   relationship between bound entities (visit, containment, scene-graph)
// EFFECT something happens to an entity (easter-egg, audio, territory voice)
// VIEW   the scene is (re)presented
// TICK   time advances; aggregate counters flow
// FORGET history is trimmed honestly — dormancy is not costume either.
//
// Cells chain via prev_hash (FNV-1a-64 over UTF-8 BYTES, format 016x,
// genesis 0x0000000000000000). Numeric comparison is law; the docs'
// 17-hex-digit canary spelling carries a stray leading zero.
//
// witness() emits the JSONL cell shape consumed by kev-substrate-
// competition's harness/replay.py — this toy is a witness-log producer.
// state_json carries {op, payload} verbatim; answers_json is "[]".

export const OPS = Object.freeze([
  'BIND',
  'LINK',
  'EFFECT',
  'VIEW',
  'TICK',
  'FORGET',
] as const);

export type Opcode = (typeof OPS)[number];

export const GENESIS_PREV_HASH = '0x' + '0'.repeat(16);

export function fnv1a64(str: string): bigint {
  // UTF-8 BYTES, not code points — the fleet canary is a byte hash.
  const bytes = new TextEncoder().encode(str);
  let h = 0xcbf29ce484222325n;
  for (const b of bytes) {
    h ^= BigInt(b);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h;
}

export function hash16(str: string): string {
  return '0x' + fnv1a64(str).toString(16).padStart(16, '0');
}

export const CANARY_VEC = 'café Δ 日本語';
export const CANARY_EXPECTED = 0x24a555471370b18dn; // BigInt — numeric law, never string-compare

export function canaryOk(): boolean {
  return fnv1a64(CANARY_VEC) === BigInt(CANARY_EXPECTED);
}

export interface QuiltCell {
  conv_id: string;
  cell_id: string;
  tick: number;
  op: Opcode;
  payload: Record<string, unknown>;
  prev_hash: string;
  cell_hash: string;
}

export interface WitnessCell {
  conv_id: string;
  cell_id: string;
  tick: number;
  state_json: string;
  answers_json: string;
  prev_hash: string;
  cell_hash: string;
}

let CELL_SEQ = 0;

export class Kernel {
  convId: string;
  cells: QuiltCell[]; // full history (the pane tails the tail)
  lastHash: string;
  tickCount: number;
  trimmed: number;

  constructor(convId = 'city') {
    this.convId = convId;
    this.cells = [];
    this.lastHash = GENESIS_PREV_HASH;
    this.tickCount = 0;
    this.trimmed = 0;
  }

  emit(op: Opcode, payload: Record<string, unknown> = {}): QuiltCell {
    if (!(OPS as readonly string[]).includes(op)) throw new Error(`unknown opcode: ${op}`);
    this.tickCount++;
    const cell: QuiltCell = {
      conv_id: this.convId,
      cell_id: `cell-${CELL_SEQ++}`,
      tick: this.tickCount,
      op,
      payload,
      prev_hash: this.lastHash,
      cell_hash: '',
    };
    cell.cell_hash = hash16(
      cell.cell_id + JSON.stringify({ op, payload }) + '[]' + cell.prev_hash
    );
    this.cells.push(cell);
    this.lastHash = cell.cell_hash;
    return cell;
  }

  forget(keep = 500): QuiltCell | null {
    // Trim history, but say so in the chain — honest dormancy.
    if (this.cells.length <= keep) return null;
    const dropped = this.cells.splice(0, this.cells.length - keep);
    this.trimmed += dropped.length;
    return this.emit('FORGET', { dropped: dropped.length, trimmed_total: this.trimmed });
  }

  counters(): Record<string, number> {
    const c: Record<string, number> = {};
    for (const cell of this.cells) c[cell.op] = (c[cell.op] || 0) + 1;
    return c;
  }

  coherence(): number {
    // Local re-verification of the retained window. Not a substitute for
    // harness/replay.py — the harness replays the exported witness.
    let last = GENESIS_PREV_HASH;
    let verified = 0;
    for (const cell of this.cells) {
      const recomputed = hash16(
        cell.cell_id +
          JSON.stringify({ op: cell.op, payload: cell.payload }) +
          '[]' +
          cell.prev_hash
      );
      if (cell.prev_hash !== last || recomputed !== cell.cell_hash) break;
      verified++;
      last = cell.cell_hash;
    }
    return this.cells.length ? verified / this.cells.length : 1;
  }

  witness(): WitnessCell[] {
    // kev harness JSONL shape: verbatim serialized strings, metrics ride
    // inside the chain or the submission withdraws (F5).
    return this.cells.map((c) => ({
      conv_id: c.conv_id,
      cell_id: c.cell_id,
      tick: c.tick,
      state_json: JSON.stringify({ op: c.op, payload: c.payload }),
      answers_json: '[]',
      prev_hash: c.prev_hash,
      cell_hash: c.cell_hash,
    }));
  }

  witnessJsonl(): string {
    return this.witness().map((c) => JSON.stringify(c)).join('\n') + '\n';
  }
}
