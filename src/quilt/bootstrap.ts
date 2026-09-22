// bootstrap.ts — wires the quilt bridge onto the night city from OUTSIDE.
// This is the only integration point: src/main.tsx gains a marked import
// and one call. Every upstream file under src/experience/ stays
// byte-identical; the wrapping below patches zustand store actions at
// runtime, so the creators' modules are never edited.

import { QuiltBridge, wrapZustandAction } from './bridge.js';
import { BackendPane } from './pane.js';
import useLocation from '../experience/stores/useLocation';
import useGlobal from '../experience/stores/useGlobal';
import useSound from '../experience/stores/useSound';

// Clickable/interactive names discovered by reading upstream
// src/experience/world/City.tsx + Experience.tsx (not by editing them).
const CITY_PROPS = [
  'Mailbox',
  'Mailbox_1',
  'Mailbox_2',
  'coffee',
  'githubFrame',
  'githubFrame_1',
  'linkedinFrame',
  'linkedinFrame_1',
  'Unobtanium',
  'CyrusAI',
  'Drone',
  'WordBlocks',
];

export function startQuiltBackend(): QuiltBridge {
  const bridge = new QuiltBridge({
    convId: `night-city:${window.location.host || 'local'}`,
  });

  // Scene (re)presentation: the city model finished loading.
  wrapZustandAction(useGlobal, 'setIsLoaded', (loaded: unknown) => {
    if (loaded === true) bridge.sceneLoaded('night-city', CITY_PROPS);
  });

  // Player movement → throttled LINK {kind:"visit"}.
  wrapZustandAction(useLocation, 'setLocation', (loc) => {
    bridge.playerMoved(loc as { x: number; y: number; z: number });
  });

  // Territory discovery ( subscribeWithSelector is enabled upstream ).
  useLocation.subscribe(
    (s: { territoriesName: string[] }) => s.territoriesName,
    (names: string[]) => {
      for (const name of names) bridge.territoryEntered(name);
    }
  );

  // Guy's voice-overs carry the easter eggs: unobtanium pickup + the
  // 100% true-fan fanfare land as EFFECT {kind:"easter-egg", id}.
  wrapZustandAction(useSound, 'playSound', (cfg) => {
    bridge.soundPlayed((cfg as { path: string }).path);
  });

  // Page visits (mailbox → /world/contact, credits, resume…) ride the
  // history API — wrapped from outside like everything else.
  const pageOf = () => window.location.pathname.replace(/\/+$/, '') || '/world';
  const origPush = history.pushState.bind(history);
  history.pushState = (...args) => {
    bridge.pageVisited(pageOf());
    return origPush(...args);
  };
  window.addEventListener('popstate', () => bridge.pageVisited(pageOf()));

  // Frame ticks → TICK cadence (every 30th frame), honest FORGET at 500.
  const loop = () => {
    bridge.tick();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // The ◈ toggle.
  new BackendPane(bridge);

  return bridge;
}
