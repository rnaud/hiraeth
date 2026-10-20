// The pose report (issue #551: the traveller once stood leaning far back, a hand on his hip, looking at the ceiling, and
// no run could make him do it again): F8 (the author's debug entries, src/dev-gate.js) writes what poses him this frame to
// the console and keeps it in a small box at the top left, read again four times a second, until F8 again. A screenshot
// of it says which layer held the pose.
//
//   poseReport(player, { ship, dialogue })   → the lines (pure: tests/pose-report.test.js)
//   installPoseReport({ player, ship, dialogue, enabled })   main.js, once (enabled(): the debug entries are shown)

/** F8: no other key of the game's (the F keys can't be given to a verb either: src/remap.js RESERVED_KEYS). */
export const POSE_REPORT_KEY = 'F8';

const n2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const v3 = (v) => (v ? `${n2(v.x)} ${n2(v.y)} ${n2(v.z)}` : '-');
const weights = (w) => Object.entries(w ?? {}).filter(([, x]) => x > 0.01).map(([k, x]) => `${k} ${n2(x)}`).join(', ') || '-';

/** What poses the traveller this frame, as lines of text. */
export function poseReport(P, { ship = null, dialogue = null } = {}) {
  const A = P?.animator, lines = [];
  if (!P) return ['pose report: no traveller'];
  lines.push(`pos ${v3(P.pos)}  vel ${v3(P.vel)}  heading ${n2(P.heading)}`);
  lines.push(`ground ${!!P.onGround}  climbing ${!!P.climbing}  mantle ${!!P.mantle}  down ${P.down ? P.down.phase ?? 'yes' : 'no'}  ride ${!!P.ride}  swim ${!!P.swim}  gliding ${!!P.gliding}  jets ${!!P.onJets}`);
  lines.push(`ship inside ${!!ship?.inside}  autopilot ${!!ship?.auto}  dialogue ${!!dialogue?.open}  talking ${!!P.talking}  overlay ${!!P.overlay}`);
  if (A) {
    lines.push(`clips ${weights(A.w)}  idleT ${n2(A.idleT)}  calm ${!!A.calm}`);
    const M = A.move;
    lines.push(`move ${M ? `${M.clip?.name} t ${n2(M.t)} w ${n2(A.moveW)} legs ${M.legs !== false}` : '-'}  matching ${!!A.matching} ${n2(A.mmW ?? 0)}  air guarded ${A.airGuarded ?? 0}`);
    const G = A.talkGesture;
    lines.push(`gestures ${G?.layers?.length ? G.layers.map((L) => `${L.id} w ${n2(L.w)}${L.out ? ' out' : ''}${L.cut ? ' cut' : ''}`).join(', ') : '-'}  talkW ${n2(A.talkW ?? 0)}`);
  } else lines.push('animator: none (the drawn rig alone)');
  const air = P.airMoves?.state?.();
  lines.push(`air move ${air ? `${air.kind} t ${n2(air.t)} w ${n2(air.w)}` : '-'}  jump layer air ${n2(P._jumpLayer?.air ?? 0)}`);
  lines.push(`aim ${P.aim ? `k ${n2(P.aim.k)}${P.aim.noArm ? ' no arm' : ''}` : '-'}  swing ${P.swingMove ? `${P.swingMove.clip} w ${n2(P.swingMove.w)}` : '-'}  edge lean ${n2(P.edge?.k ?? 0)}`);
  lines.push(`gesture ${P._gesture?.kind ?? '-'}  get-up ${P._riseMove ? 'rising' : P._riseOut ? 'easing out' : '-'}  flinch ${!!P._flinch}  stagger ${!!P._stagger}  lock ${!!P.lockOn}`);
  return lines;
}

/** F8 toggles the box (and logs the report); while it shows it is read again every quarter second. */
export function installPoseReport({ player, ship = null, dialogue = () => null, enabled = () => true, win = globalThis.window, doc = globalThis.document } = {}) {
  if (!win?.addEventListener || !doc?.createElement) return null;
  let box = null, timer = 0;
  const text = () => poseReport(player, { ship, dialogue: dialogue() }).join('\n');
  const close = () => { clearInterval(timer); timer = 0; box?.remove(); box = null; };
  win.addEventListener('keydown', (e) => {
    if (e.code !== POSE_REPORT_KEY || e.repeat || !enabled()) return;
    e.preventDefault();
    if (box) { close(); return; }
    const t = text();
    console.info(`[pose report]\n${t}`);
    box = doc.createElement('pre');
    box.className = 'pose-report';
    box.style.cssText = 'position:fixed;top:44px;left:8px;z-index:2147483000;margin:0;padding:8px 10px;max-width:min(92vw,760px);white-space:pre-wrap;'
      + 'background:#f6f1e4ee;color:#2b211f;border:2px solid #2b211f;font:11px/1.35 ui-monospace,Menlo,Consolas,monospace;pointer-events:none';
    box.textContent = `pose report (F8 closes)\n${t}`;
    doc.body.appendChild(box);
    timer = setInterval(() => { if (box) box.textContent = `pose report (F8 closes)\n${text()}`; }, 250);
  });
  return { close, text };
}
