// pane.ts — the "see the backend in production" toggle.
// Phosphor on abyssal black — the fleet terminal, not AI-slop gradients.
// One pane: live cell tail + chain vitals + witness export.

import type { QuiltBridge } from './bridge.js';

export class BackendPane {
  private bridge: QuiltBridge;
  private tail: number;
  private visible = false;
  private toggle!: HTMLButtonElement;
  private pane!: HTMLDivElement;

  constructor(bridge: QuiltBridge, { tail = 14 } = {}) {
    this.bridge = bridge;
    this.tail = tail;
    this.buildDom();
    bridge.onCell(() => {
      if (this.visible) this.render();
    });
  }

  private buildDom(): void {
    const style = document.createElement('style');
    style.textContent = `
      #quilt-toggle {
        position: fixed; top: 60px; right: 16px; z-index: 300;
        background: rgba(10,14,12,0.92); color: #7dffb0;
        border: 1px solid #1f3a2c; border-radius: 8px;
        font: 600 13px/1 ui-monospace, monospace;
        padding: 8px 12px; cursor: pointer;
      }
      #quilt-toggle:hover { background: #12241a; }
      #quilt-toggle.on { color: #0a0e0c; background: #7dffb0; }
      #quilt-pane {
        position: fixed; top: 96px; right: 16px; bottom: 16px; width: 420px;
        z-index: 290; display: none; flex-direction: column;
        background: rgba(6,10,8,0.94); border: 1px solid #1f3a2c;
        border-radius: 10px; overflow: hidden;
        font: 11px/1.5 ui-monospace, monospace; color: #9fd8b8;
      }
      #quilt-pane.show { display: flex; }
      #quilt-vitals {
        padding: 8px 12px; border-bottom: 1px solid #1f3a2c;
        display: flex; gap: 14px; flex-wrap: wrap; color: #7dffb0;
      }
      #quilt-vitals .dim { color: #4a7a5e; }
      #quilt-tail { flex: 1; overflow-y: auto; padding: 8px 12px; }
      #quilt-tail .cell { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      #quilt-tail .op-BIND { color: #7dcfff; }
      #quilt-tail .op-LINK { color: #bb9af7; }
      #quilt-tail .op-EFFECT { color: #f7768e; }
      #quilt-tail .op-VIEW { color: #e0af68; }
      #quilt-tail .op-TICK { color: #4a7a5e; }
      #quilt-tail .op-FORGET { color: #ff9e64; }
      #quilt-foot {
        padding: 8px 12px; border-top: 1px solid #1f3a2c;
        display: flex; justify-content: space-between; align-items: center;
      }
      #quilt-export {
        background: none; border: 1px solid #1f3a2c; border-radius: 6px;
        color: #7dffb0; font: 600 11px ui-monospace, monospace;
        padding: 4px 10px; cursor: pointer;
      }
      #quilt-export:hover { background: #12241a; }
    `;
    document.head.appendChild(style);

    this.toggle = document.createElement('button');
    this.toggle.id = 'quilt-toggle';
    this.toggle.textContent = '◈ backend';
    this.toggle.title = 'Toggle the quilt substrate (Q)';
    this.toggle.addEventListener('click', () => this.togglePane());

    this.pane = document.createElement('div');
    this.pane.id = 'quilt-pane';
    this.pane.innerHTML = `
      <div id="quilt-vitals"></div>
      <div id="quilt-tail"></div>
      <div id="quilt-foot">
        <span class="dim" style="color:#4a7a5e">quilt kernel · 6 opcodes · prev_hash chain</span>
        <button id="quilt-export">⤓ witness.jsonl</button>
      </div>`;
    document.body.appendChild(this.toggle);
    document.body.appendChild(this.pane);
    (this.pane.querySelector('#quilt-export') as HTMLButtonElement).addEventListener(
      'click',
      () => this.exportWitness()
    );
    window.addEventListener('keydown', (e) => {
      if (e.key === 'q' || e.key === 'Q') this.togglePane();
    });
  }

  togglePane(): void {
    this.visible = !this.visible;
    this.toggle.classList.toggle('on', this.visible);
    this.pane.classList.toggle('show', this.visible);
    if (this.visible) this.render();
  }

  render(): void {
    const s = this.bridge.stats();
    const cells = this.bridge.kernel.cells;
    const vitals = this.pane.querySelector('#quilt-vitals') as HTMLDivElement;
    const ops = Object.entries(s.counters)
      .map(([op, n]) => `<span>${op} ${n}</span>`)
      .join('');
    vitals.innerHTML = `
      <span>chain <strong>${s.cells}</strong></span>
      <span>coherence <strong>${s.coherence}</strong></span>
      <span class="dim">head ${s.head}…</span>${ops}`;
    const tail = this.pane.querySelector('#quilt-tail') as HTMLDivElement;
    tail.innerHTML = cells
      .slice(-this.tail)
      .map(
        (c) =>
          `<div class="cell op-${c.op}">${String(c.tick).padStart(5)} ${c.op.padEnd(6)} ` +
          `${JSON.stringify(c.payload).slice(0, 80)} ${c.cell_hash.slice(2, 10)}…</div>`
      )
      .join('');
    tail.scrollTop = tail.scrollHeight;
  }

  exportWitness(): void {
    const blob = new Blob([this.bridge.kernel.witnessJsonl()], {
      type: 'application/jsonl',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `witness-${this.bridge.kernel.convId.replace(/[^\w.-]/g, '_')}.jsonl`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
