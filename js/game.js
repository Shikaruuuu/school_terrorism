// 〇〇にテロリスト — ゲーム本体（全ステージ共通のルール）
// ステージ固有のマップ・敵・物語・人物は TG.STAGES（map.js＝学校、mall.js＝ショッピングモール）にある。
(function () {
  const MD = TG.models, AU = TG.audio;
  let S = null, M = null; // 遊んでいるステージと、そのマップ
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

  const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (isTouch) document.body.classList.add('touch');

  // ===================== 定数 =====================
  const R_PLAYER = 0.28;
  const SPEED = { crouch: 1.35, walk: 2.3, run: 4.3, box: 1.2 };
  const E_SPEED = { walk: 1.7, inv: 2.1, run: 3.7, search: 2.4 };
  const ALERT_TIME = 14, EVASION_TIME = 16;
  const SIGHT_RANGE = 9, SIGHT_FOV = 50 * Math.PI / 180, ALERT_FOV = 68 * Math.PI / 180;

  // ===================== レンダラ =====================
  const canvas = $('view');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 200);
  scene.add(camera);
  // 空・光・影・ポスト処理・画質は gfx.js に任せる
  const GFX = TG.gfx;
  GFX.init(renderer, scene, camera);
  // ステージの3D。作るのは最初に遊ぶときの1回だけで、切り替えは表示・非表示で行う
  const stageWorld = {};
  let worldRefs = null;
  let dyn = new THREE.Group();
  scene.add(dyn);

  function resize() {
    // 実際に表示されているキャンバスの大きさに合わせる
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    GFX.resize(w, h);
    camera.aspect = w / h;
    // 一人称視点。縦長の画面では少し広めに
    camera.fov = w / h < 1 ? 80 : 70;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => { setTimeout(resize, 120); setTimeout(resize, 500); });
  resize();

  // ===================== 当たり判定・視線・経路 =====================
  function collides(x, z, r) {
    const x0 = Math.floor(x - r), x1 = Math.floor(x + r), z0 = Math.floor(z - r), z1 = Math.floor(z + r);
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (!M.solid(cx, cz)) continue;
        const nx = clamp(x, cx, cx + 1), nz = clamp(z, cz, cz + 1);
        if ((x - nx) * (x - nx) + (z - nz) * (z - nz) < r * r) return true;
      }
    }
    return false;
  }
  function moveBy(e, dx, dz, r) {
    if (!collides(e.x + dx, e.z, r)) e.x += dx;
    if (!collides(e.x, e.z + dz, r)) e.z += dz;
    // 階段の端まで来たら、上下の階の同じ位置へ移る（主人公・敵・女の子すべて）
    if (M.portal) {
      const cx = Math.floor(e.x), cz = Math.floor(e.z), to = M.portal[cz * M.W + cx];
      if (to >= 0) { e.x += (to % M.W) - cx; e.z += ((to / M.W) | 0) - cz; }
    }
  }
  const floorOf = (o) => M.floorOf(o.x);
  const sameFloor = (a, b) => M.floorOf(a.x) === M.floorOf(b.x);
  // ゲーム上の座標 → 3Dの座標
  function place(obj, x, z, y) { obj.position.set(M.wx(x), M.wy(x, z) + (y || 0), z); }

  // 歩いて行けるマス（4方向＋階段のポータル）。ステージの封鎖が詰んでいないかの確認に使う
  function reachFrom(x, z) {
    const W = M.W, seen = new Uint8Array(W * M.H);
    const s0 = nearestFree(Math.floor(x), Math.floor(z));
    if (!s0) return seen;
    const q = [s0[1] * W + s0[0]];
    seen[q[0]] = 1;
    while (q.length) {
      const i = q.pop(), cx = i % W, cz = (i / W) | 0;
      for (const [dx, dz] of DIRS4) {
        const nx = cx + dx, nz = cz + dz;
        if (M.solid(nx, nz)) continue;
        let ni = nz * W + nx;
        if (M.portal && M.portal[ni] >= 0) { seen[ni] = 1; ni = M.portal[ni]; }
        if (seen[ni]) continue;
        seen[ni] = 1;
        q.push(ni);
      }
    }
    return seen;
  }
  const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const reached = (seen, x, z) => !!seen[Math.floor(z) * M.W + Math.floor(x)];
  // マップが変わった（シャッターが下りた）ときは、レーダーと全員の経路を作り直す
  function mapChanged() {
    drawMap();
    if (!G) return;
    for (const e of G.enemies) e.path = null;
    for (const f of G.followers) f.path = null;
    G.guideT = 0;
  }
  // ステージ固有の仕掛け（S.prepare / S.onRescue / S.tick）に渡す道具
  const ctx = {
    get G() { return G; }, get P() { return P; }, get dyn() { return dyn; }, get M() { return M; },
    place, findPath, reachFrom, reached, mapChanged, say: (w, t, d) => say(w, t, d), sfx: AU.sfx, isActive: (e) => isActive(e),
  };

  function loadStage(id) {
    if (S && S.id === id) return;
    S = TG.STAGES[id];
    preloadFaces();
    M = S.map;
    for (const k in stageWorld) stageWorld[k].group.visible = false;
    if (!stageWorld[id]) {
      const group = new THREE.Group();
      scene.add(group);
      stageWorld[id] = { group, refs: S.buildWorld(group) };
    }
    stageWorld[id].group.visible = true;
    worldRefs = stageWorld[id].refs;
    GFX.setLightSources(worldRefs.lightSources || []);
    GFX.setLook(S.look);
    allocPath();
    drawMap();
  }
  function los(x0, z0, x1, z1, lowBlocks) {
    const dx = x1 - x0, dz = z1 - z0, d = Math.hypot(dx, dz);
    const n = Math.ceil(d / 0.2);
    let lx = -1, lz = -1;
    const sx = Math.floor(x0), sz = Math.floor(z0), tx = Math.floor(x1), tz = Math.floor(z1);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const cx = Math.floor(x0 + dx * t), cz = Math.floor(z0 + dz * t);
      if (cx === lx && cz === lz) continue;
      lx = cx; lz = cz;
      if ((cx === sx && cz === sz) || (cx === tx && cz === tz)) continue;
      if (M.sight(cx, cz)) return false;
      if (lowBlocks && M.low(cx, cz)) return false;
    }
    return true;
  }

  // A*（8方向、角のすり抜けなし）
  // 2階建てのマップでは、階段の端の「ポータル」のマスに入ると上下の階の同じ位置へつながる
  let NW = 0, gS, came, via, stamp, closed;
  let curStamp = 0;
  function allocPath() {
    NW = M.W;
    const NN = M.W * M.H;
    gS = new Float32Array(NN); came = new Int32Array(NN); via = new Int32Array(NN);
    stamp = new Uint32Array(NN); closed = new Uint32Array(NN);
    curStamp = 0;
  }
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  function nearestFree(x, z) {
    if (!M.solid(x, z)) return [x, z];
    for (let r = 1; r <= 3; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (!M.solid(x + dx, z + dz)) return [x + dx, z + dz];
      }
    }
    return null;
  }
  function findPath(fx, fz, tx, tz) {
    const s = nearestFree(Math.floor(fx), Math.floor(fz));
    const t = nearestFree(Math.floor(tx), Math.floor(tz));
    if (!s || !t) return null;
    curStamp++;
    const PT = M.portal;
    const si = s[1] * NW + s[0];
    let ti = t[1] * NW + t[0];
    if (PT && PT[ti] >= 0) ti = PT[ti];
    // 見積もりは3D上の距離（ポータルを通っても見た目の位置は変わらないので、遠回りを見積もりすぎない）
    const tX = M.wx(ti % NW), tZ = (ti / NW) | 0;
    const heap = [];
    const h = (i) => { const dx = Math.abs(M.wx(i % NW) - tX), dz = Math.abs(((i / NW) | 0) - tZ); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    const push = (i, f) => {
      heap.push([f, i]);
      let k = heap.length - 1;
      while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let k = 0;
        for (;;) {
          const l = k * 2 + 1, r = l + 1;
          let m = k;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]]; k = m;
        }
      }
      return top;
    };
    stamp[si] = curStamp; gS[si] = 0; came[si] = -1; via[si] = -1;
    push(si, h(si));
    let found = false, iter = 0;
    while (heap.length && iter++ < 30000) {
      const [, i] = pop();
      if (closed[i] === curStamp) continue;
      closed[i] = curStamp;
      if (i === ti) { found = true; break; }
      const x = i % NW, z = (i / NW) | 0;
      for (const [dx, dz, c] of DIRS) {
        const nx = x + dx, nz = z + dz;
        if (M.solid(nx, nz)) continue;
        if (dx && dz && (M.solid(x + dx, z) || M.solid(x, z + dz))) continue;
        let ni = nz * NW + nx, pi = -1;
        if (PT && PT[ni] >= 0) { pi = ni; ni = PT[ni]; }
        if (closed[ni] === curStamp) continue;
        const g = gS[i] + c;
        if (stamp[ni] !== curStamp || g < gS[ni]) {
          stamp[ni] = curStamp; gS[ni] = g; came[ni] = i; via[ni] = pi;
          push(ni, g + h(ni));
        }
      }
    }
    if (!found) return null;
    const out = [];
    for (let i = ti; i !== si && i !== -1; i = came[i]) {
      out.push({ x: (i % NW) + 0.5, z: ((i / NW) | 0) + 0.5 });
      // 階を移る直前のマス（ここに入ると上下の階へ移る）
      if (via[i] >= 0) out.push({ x: (via[i] % NW) + 0.5, z: ((via[i] / NW) | 0) + 0.5, portal: true });
    }
    out.reverse();
    return out;
  }

  // ===================== 状態 =====================
  let G = null; // 1プレイ分の状態
  let P = null; // プレイヤー
  let screen = 'title';

  // 女の子の居場所。同じプレイ（コンティニュー・最初から）では変えず、新しく始めるたびに選び直す
  const lastSpot = {};
  function chooseGirlSpot(keep) {
    const n = S.girlSpots.length, prev = lastSpot[S.id] === undefined ? -1 : lastSpot[S.id];
    if (!keep || prev < 0) {
      let i = Math.floor(Math.random() * n);
      if (n > 1 && i === prev) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
      lastSpot[S.id] = i;
    }
    return S.girlSpots[lastSpot[S.id]];
  }

  function newGame(stageId, diff, keepSpot) {
    loadStage(stageId);
    scene.remove(dyn);
    dyn = new THREE.Group();
    scene.add(dyn);
    const spot = chooseGirlSpot(keepSpot);
    G = {
      spot, clueFound: false,
      stage: stageId, diff, D: TG.DIFFS[diff], time: 0, phase: 'sneak', alertT: 0, evaT: 0, lastKnown: null,
      stats: { alerts: 0, downs: 0, ties: 0, freed: 0, damage: 0 },
      enemies: [], items: [], hostages: [], followers: [], fx: [], noises: [],
      girl: null, girlFreed: false, freedRooms: new Set(), anySee: false, objKey: '', gateMsgT: 0,
      hint: { left: false, cqc: false, seen: false }, cleared: false, flags: {},
      informants: [], hints: [], talk: null, say: null, closedExits: new Set(), exitPick: null,
    };
    hideTalk();
    // ステージ固有の準備（モールの封鎖など）。敵を置く前に、マップの形を決める
    if (S.prepare) S.prepare(ctx, spot, diff);
    drawMap();
    // プレイヤー（少し透かして、向こう側も見えるようにする）
    const pm = S.chars.player();
    pm.group.traverse((m) => {
      if (!m.isMesh || m.geometry.type === 'CircleGeometry') return;
      m.material = m.material.clone();
      m.material.transparent = true;
      m.material.opacity = 0.9;
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 28), new THREE.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.85, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    pm.group.add(ring);
    dyn.add(pm.group);
    P = {
      model: pm, camDist: 2.4, camOver: 0,
      x: 0, z: 0, a: Math.PI / 2, camA: Math.PI / 2, pitch: 0, eye: 1.45, bobT: 0, hp: 100, crouch: false, hidden: null,
      inv: { key: 0 },
      moving: false, running: false, actT: 0, noiseT: 0, regenT: 0, trail: [], stepT: 0, hurtT: 0,
    };
    // 開始時はロッカーの中
    const L0 = M.lockers.find((l) => l.x === S.start.locker.x && l.z === S.start.locker.z);
    P.x = L0.x + 0.5 + Math.sin(L0.face); P.z = L0.z + 0.5 + Math.cos(L0.face);
    enterLocker(L0, true);

    // 敵
    S.lists[diff].forEach((id) => {
      const def = id === 'hold' ? { room: spot.room, route: spot.guard } : S.enemies[id];
      const route = def.route.map((r) => ({ x: r[0] + 0.5, z: r[1] + 0.5, wait: r[2] || 0, looks: r.slice(3) }));
      const model = MD.terrorist(!!def.boss);
      dyn.add(model.group);
      const mark = MD.label('!', '#ff3b30');
      mark.visible = false;
      dyn.add(mark);
      const cone = makeCone();
      dyn.add(cone);
      const e = {
        id, def, route, boss: !!def.boss, room: def.room, x: route[0].x, z: route[0].z, a: route[0].looks[0] !== undefined ? route[0].looks[0] : 0,
        wp: 0, atWp: true, waitT: route[0].wait, state: 'patrol', path: null, pathI: 0, goal: null, susp: 0, hp: def.boss ? 3 : 3,
        model, mark, markT: 0, markText: '', cone, downT: 0, shootT: 1, reactT: 0, stun: 0, repathT: 0, stuckT: 0, lookT: 0,
        seenBodies: new Set(), bodyT: Math.random() * 0.3, seeP: 0, moving: false, moveSpeed: 0, tieT: 0,
      };
      G.enemies.push(e);
    });

    // 拾える物は鍵（ステージにあれば）と、女の子の居場所の手がかりだけ（近づくと自動で拾う）
    if (S.key) spawnItem('key', S.key.x, S.key.z);
    spawnItem(S.clueItem, spot.charm.x, spot.charm.z);

    // 人質
    S.hostages.forEach((h) => {
      const m = S.chars.mob(h.i);
      place(m.group, h.x, h.z);
      m.group.rotation.y = h.face;
      MD.pose(m, 'sit', false, 0);
      // 座っている人質は影を落とさない（数が多く、影の描画が重くなるため）
      m.group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      dyn.add(m.group);
      G.hostages.push({ x: h.x, z: h.z, model: m });
    });

    spawnInformants(spot);

    // 助ける女の子
    {
      const m = S.chars.girl();
      place(m.group, spot.pos.x, spot.pos.z);
      m.group.rotation.y = spot.face;
      MD.pose(m, 'sit', false, 0);
      dyn.add(m.group);
      // ハートは壁越しには見えない（近づくか、キーホルダーを拾うまでは探す）
      const heart = MD.label('♥', '#ff7aa8', 72, 0.7);
      heart.material.depthTest = true;
      place(heart, spot.pos.x, spot.pos.z, 1.6);
      heart.visible = false;
      dyn.add(heart);
      G.girl = { x: spot.pos.x, z: spot.pos.z, a: spot.face, model: m, heart, freed: false, crouch: false, moving: false, kind: 'girl', hp: 100, regenT: 0, hurtT: 0, speedNow: 0 };
    }

    if (worldRefs.reset) worldRefs.reset();
    // 目的地のビーコン
    beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.6, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
    beacon.position.y = 1.3;
    beacon.visible = false;
    dyn.add(beacon);
    G.guide = null; G.guideT = 0;
    look.yaw = look.pitch = 0;
    AU.bgm('sneak');
    updateHUD(true);
  }

  function spawnItem(type, x, z, n) {
    const m = MD.item(type);
    place(m, x, z, 0.05);
    dyn.add(m);
    const glow = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.36, 24), new THREE.MeshBasicMaterial({ color: type === 'key' ? 0xffd34d : 0xff8fb6, transparent: true, opacity: 0.7, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2;
    place(glow, x, z, 0.04);
    dyn.add(glow);
    G.items.push({ type, x, z, n: n || 1, model: m, glow, base: M.wy(x, z), taken: false });
  }

  // ===================== 話しかけられる人（学校のクラスメートなど） =====================
  // S.informants = { count, spots: [{ i, name, x, z, face, room, always }], hints: (spot) => ({ 種類: [{ short, line, rect }] }) }
  // ヒントは女の子の実際の居場所から作るので、必ず正しい。種類（方角・場所・特徴）が偏らないように配る
  const TALK_TIME = 1.8;
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function spawnInformants(spot) {
    const I = S.informants;
    if (!I) return;
    // 女の子と同じ部屋の人と、封鎖で行けない場所の人は出さない
    const seen = reachFrom(P.x, P.z);
    const pool = I.spots.filter((c) => c.room !== spot.room && reached(seen, c.x, c.z));
    const chosen = I.pick ? I.pick(pool, shuffle) : pool.filter((c) => c.always).concat(shuffle(pool.filter((c) => !c.always))).slice(0, I.count);
    const lines = I.hints ? I.hints(spot) : null;
    const types = lines ? shuffle(Object.keys(lines)) : [];
    chosen.forEach((c, k) => {
      let hint;
      if (I.hintFor) hint = I.hintFor(spot, c, G);
      else {
        const vs = lines[types[k % types.length]];
        hint = vs[Math.floor(k / types.length) % vs.length];
      }
      const m = c.model ? c.model() : S.chars.mob(c.i);
      place(m.group, c.x, c.z);
      m.group.rotation.y = c.face;
      MD.pose(m, 'crouch', false, 0);
      dyn.add(m.group);
      const mark = MD.label('…', '#7fe3ff', 72, 0.7);
      mark.material.depthTest = true;
      mark.visible = false;
      dyn.add(mark);
      const keyHint = I.keyHints ? I.keyHints[k % I.keyHints.length] : null;
      G.informants.push({ x: c.x, z: c.z, name: c.name, cast: c.cast, faces: c.faces || [], hint, keyHint, model: m, mark, talked: false, keyTalked: false });
    });
  }
  function informantNear() {
    let best = null, bd = 1.6;
    for (const c of G.informants) { const d = dist(P, c); if (d < bd) { bd = d; best = c; } }
    return best;
  }
  // 女の子を助けたあと、鍵がまだなら、クラスメートは鍵のありかを教えてくれる
  const askKey = () => !!(G.girlFreed && S.key && !P.inv.key);
  const hasNews = (c) => (askKey() ? c.keyHint && !c.keyTalked : !c.talked);
  // 話しかける：ひそひそ声でも少し時間がかかり、すぐ近くの敵には聞こえる
  function startTalk(c) {
    P.a = Math.atan2(c.x - P.x, c.z - P.z);
    if (!hasNews(c)) {
      const kh = askKey() && c.keyHint;
      say(c.name, kh ? c.keyHint.line : c.hint.line, 5, c.cast, kh ? c.faces[2] : c.faces[1]);
      return;
    }
    G.talk = { c, t: 0 };
    makeNoise(P.x, P.z, 2.4, 'talk');
    AU.sfx.text();
  }
  function finishTalk() {
    const c = G.talk.c;
    G.talk = null;
    if (askKey()) {
      c.keyTalked = true;
      G.keyHint = c.keyHint;
      say(c.name, c.keyHint.line, 6, c.cast, c.faces[2]);
      AU.sfx.pickup();
      return;
    }
    c.talked = true;
    // 道の情報（route）は目的の欄には並べない
    if (!c.hint.route && !G.hints.some((h) => h.short === c.hint.short)) G.hints.push(c.hint);
    say(c.name, c.hint.line, 6, c.cast, c.faces[1]);
    AU.sfx.pickup();
  }
  // 聞いたヒントが指す範囲（重なった所）。助けたあとは鍵の話の範囲
  function hintRegion() {
    if (G.girlFreed) return G.keyHint && !P.inv.key ? G.keyHint.rect : null;
    let r = null;
    for (const h of G.hints) {
      if (!h.rect) continue;
      r = r ? { x0: Math.max(r.x0, h.rect.x0), z0: Math.max(r.z0, h.rect.z0), x1: Math.min(r.x1, h.rect.x1), z1: Math.min(r.z1, h.rect.z1) } : Object.assign({}, h.rect);
    }
    return r;
  }
  // 画面上部の吹き出し
  const talkEl = $('talk'), talkWho = $('talkWho'), talkText = $('talkText'), talkBar = $('talkBar');
  let talkSlot = null;
  // who：表示名、cast/face：立ち絵（TG.CAST の人物と表情）
  function say(who, text, t, cast, face) {
    if (!G) return;
    talkSlot = talkSlot || makeSlot('talkPort');
    G.say = { t: t || 5 };
    talkWho.textContent = who;
    talkWho.style.color = cast && TG.CAST[cast] ? TG.CAST[cast].color : '';
    talkText.textContent = text;
    talkBar.hidden = true;
    if (cast) showPortrait(talkSlot, cast, face); else hidePortrait(talkSlot);
    talkEl.hidden = false;
  }
  // 動きながら聞こえる短い一言（操作は止めない）。人の話を聞いている最中は割り込まない
  function bark(key, cast, face, lines, cd) {
    if (!G || !lines || screen !== 'play' || G.talk) return;
    if (G.say && !G.say.bark && G.say.t > 1.2) return;
    G.barkT = G.barkT || {};
    if (G.barkT[key] > G.time) return;
    G.barkT[key] = G.time + (cd || 10);
    const text = Array.isArray(lines) ? lines[Math.floor(Math.random() * lines.length)] : lines;
    say(TG.CAST[cast] ? TG.CAST[cast].name : '', text, 2.8, cast, face);
    G.say.bark = true;
  }
  // 女の子の一言（ステージの S.barks から）
  const girlBark = (key, face, cd) => { if (S.barks && S.barks[key] && G.girl && G.girl.hp > 0) bark('g-' + key, S.heroine, face, S.barks[key], cd); };
  function hideTalk() { talkEl.hidden = true; }
  function updateTalkUI(dt) {
    if (G.talk) {
      if (talkWho.textContent !== G.talk.c.name || talkText.textContent !== '（ひそひそ……）') {
        talkSlot = talkSlot || makeSlot('talkPort');
        talkWho.style.color = TG.CAST[G.talk.c.cast] ? TG.CAST[G.talk.c.cast].color : '';
        if (G.talk.c.cast) showPortrait(talkSlot, G.talk.c.cast, G.talk.c.faces[0]); else hidePortrait(talkSlot);
      }
      talkWho.textContent = G.talk.c.name;
      talkText.textContent = '（ひそひそ……）';
      talkBar.hidden = false;
      talkBar.style.width = Math.min(100, (G.talk.t / TALK_TIME) * 100) + '%';
      talkEl.hidden = false;
    } else if (G.say) {
      G.say.t -= dt;
      if (G.say.t <= 0) { G.say = null; hideTalk(); }
    } else if (!talkEl.hidden) hideTalk();
  }

  // ===================== 視界の扇形 =====================
  const CONE_RAYS = 18;
  function makeCone() {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array((CONE_RAYS + 2) * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const idx = [];
    for (let i = 1; i <= CONE_RAYS; i++) idx.push(0, i, i + 1);
    geo.setIndex(idx);
    // 懐中電灯の光のように、敵から離れるほど薄くなる扇（加算で光る）
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { color: { value: new THREE.Color(0xfff27a) }, opacity: { value: 0.17 }, center: { value: new THREE.Vector3() }, range: { value: 9 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 color, center; uniform float opacity, range; varying vec3 vP; void main(){ float d = clamp(distance(vP.xz, center.xz) / range, 0.0, 1.0); float a = opacity * pow(1.0 - d, 1.3) * 1.6; gl_FragColor = vec4(color * a, 1.0); }',
    });
    // 互換のため color / opacity を本体の値に見せる
    Object.defineProperty(mat, 'opacity', { get: () => mat.uniforms.opacity.value, set: (v) => { if (mat.uniforms) mat.uniforms.opacity.value = v; } });
    mat.color = mat.uniforms.color.value;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    return mesh;
  }
  function enemyRange(e) {
    return (e.boss ? SIGHT_RANGE + 1 : SIGHT_RANGE) * G.D.sight * (G.phase === 'alert' ? 1.3 : 1);
  }
  function enemyFov(e) { return G.phase === 'alert' || e.state === 'alert' ? ALERT_FOV : SIGHT_FOV; }
  function updateCone(e) {
    const active = e.state !== 'down' && e.state !== 'tied';
    e.cone.visible = active;
    if (!active) return;
    const pos = e.cone.geometry.attributes.position.array;
    const range = enemyRange(e), fov = enemyFov(e);
    const ox = M.wx(e.x) - e.x, oy = M.wy(e.x, e.z) + 0.05;
    pos[0] = e.x + ox; pos[1] = oy; pos[2] = e.z;
    e.cone.material.uniforms.center.value.set(pos[0], oy, pos[2]);
    e.cone.material.uniforms.range.value = range;
    for (let i = 0; i <= CONE_RAYS; i++) {
      const ang = e.a - fov + (2 * fov * i) / CONE_RAYS;
      const dx = Math.sin(ang), dz = Math.cos(ang);
      let d = 0.3;
      while (d < range) {
        const cx = Math.floor(e.x + dx * d), cz = Math.floor(e.z + dz * d);
        if (M.sight(cx, cz)) break;
        d += 0.25;
      }
      d = Math.min(d, range);
      const k = (i + 1) * 3;
      pos[k] = e.x + ox + dx * d; pos[k + 1] = oy; pos[k + 2] = e.z + dz * d;
    }
    e.cone.geometry.attributes.position.needsUpdate = true;
    const c = e.state === 'alert' ? 0xff3b30 : (e.state === 'investigate' || e.susp > 0.25 ? 0xffa53a : 0xfff27a);
    e.cone.material.color.setHex(c);
    e.cone.material.opacity = e.state === 'alert' ? 0.22 : 0.16;
  }

  // ===================== 演出 =====================
  function showMark(e, text, color, t) {
    if (e.markText !== text) { MD.setLabel(e.mark, text, color); e.markText = text; }
    e.mark.visible = true;
    e.markT = t || 1.6;
  }
  function noiseRing(x, z, r) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    place(m, x, z, 0.08);
    dyn.add(m);
    G.fx.push({ m, t: 0, life: 0.6, kind: 'ring', r });
  }
  function tracer(x0, z0, x1, z1, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(M.wx(x0), M.wy(x0, z0) + 1.2, z0), new THREE.Vector3(M.wx(x1), M.wy(x1, z1) + 1.1, z1)]);
    const m = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: color || 0xfff3a0, transparent: true }));
    dyn.add(m);
    G.fx.push({ m, t: 0, life: 0.12, kind: 'line' });
  }
  function updateFx(dt) {
    for (let i = G.fx.length - 1; i >= 0; i--) {
      const f = G.fx[i];
      f.t += dt;
      const k = f.t / f.life;
      if (f.kind === 'ring') { const s = f.r * k; f.m.scale.set(s, s, s); f.m.material.opacity = 0.5 * (1 - k); }
      else if (f.kind === 'line') f.m.material.opacity = 1 - k;
      if (k >= 1) {
        dyn.remove(f.m);
        G.fx.splice(i, 1);
      }
    }
  }

  // ===================== 音 =====================
  function makeNoise(x, z, r, kind) {
    noiseRing(x, z, r);
    for (const e of G.enemies) {
      if (e.state === 'down' || e.state === 'tied' || e.state === 'alert') continue;
      if (Math.hypot(e.x - x, e.z - z) <= r) investigate(e, x, z);
    }
  }

  // ===================== 敵AI =====================
  function setPath(e, x, z) {
    e.path = findPath(e.x, e.z, x, z);
    e.pathI = 0;
    e.goal = { x, z };
    e.stuckT = 0;
    e.replan = 0;
  }
  function turnTo(e, target, maxStep) {
    const d = angDiff(e.a, target);
    e.a += clamp(d, -maxStep, maxStep);
  }
  function follow(e, speed, dt) {
    if (!e.path) return true;
    while (e.pathI < e.path.length) {
      const last = e.pathI === e.path.length - 1;
      const p = last ? e.goal : e.path[e.pathI];
      if (!sameFloor(p, e)) {
        // 階を移ったあとは、前の階に残った経路の点を飛ばす。
        // 目的地が別の階なのに経路が尽きたら（引っかかって飛ばしたときなど）、引き直す
        if (!last) { e.pathI++; continue; }
        if (e.replan++ > 1) { e.path = null; return true; }
        e.path = findPath(e.x, e.z, p.x, p.z);
        e.pathI = 0;
        if (!e.path) return true;
        continue;
      }
      const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz);
      if (d < (last ? 0.15 : 0.35)) { e.pathI++; continue; }
      const st = Math.min(d, speed * dt);
      const bx = e.x, bz = e.z;
      moveBy(e, (dx / d) * st, (dz / d) * st, 0.28);
      turnTo(e, Math.atan2(dx, dz), dt * 9);
      e.moving = true; e.moveSpeed = speed;
      if (Math.hypot(e.x - bx, e.z - bz) < st * 0.3) {
        e.stuckT += dt;
        if (e.stuckT > 0.7) { e.stuckT = 0; e.pathI++; }
      } else e.stuckT = 0;
      return false;
    }
    e.path = null;
    return true;
  }
  const isActive = (e) => e.state !== 'down' && e.state !== 'tied';

  function investigate(e, x, z, loud) {
    if (!isActive(e) || e.state === 'alert') return;
    const fresh = e.state !== 'investigate';
    e.state = 'investigate';
    e.invPos = { x, z };
    e.lookT = 0;
    e.reactT = fresh ? 0.6 : 0;
    setPath(e, x, z);
    showMark(e, '?', '#ffd23f', 2.2);
    if (fresh && dist(e, P) < 16) AU.sfx.huh();
    if (fresh && sameFloor(e, P) && dist(e, P) < 11) bark('huh', e.boss ? 'leader' : 'terrorist', 'intimidate', TG.BARKS.huh, 14);
    if (loud) e.susp = Math.max(e.susp, 0.4);
  }

  function spotted(e, target) {
    G.lastKnown = { x: target.x, z: target.z };
    G.alertT = ALERT_TIME;
    if (G.phase !== 'alert') {
      G.phase = 'alert';
      G.stats.alerts++;
      AU.sfx.alert();
      AU.bgm('alert');
      flash('alert');
      GFX.flash(0xff2a20, 0.35);
      bark('spot', e.boss ? 'leader' : 'terrorist', 'angry', e.boss ? TG.BARKS.bossSpot : TG.BARKS.spot, 6);
    }
    showMark(e, '!', '#ff3b30', 1.8);
    e.reactT = 0.7;
    for (const o of G.enemies) {
      if (!isActive(o)) continue;
      if (o.state !== 'alert') { o.state = 'alert'; o.path = null; o.repathT = 0; if (o !== e) o.reactT = 0.3 + Math.random() * 0.5; }
    }
  }

  // 見えているか。戻り値 0〜1（近いほど大きい）
  function sees(e, tx, tz, mul, low) {
    if (mul <= 0) return 0;
    const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz);
    const range = enemyRange(e) * mul;
    if (d > Math.max(range, mul > 0 ? 1.1 : 0)) return 0;
    if (d > 1.1) {
      const fx = Math.sin(e.a), fz = Math.cos(e.a);
      if ((dx * fx + dz * fz) / d < Math.cos(enemyFov(e))) return 0;
    }
    if (!los(e.x, e.z, tx, tz, low && d > 1.8)) return 0;
    return 1 - (d / Math.max(range, 1)) * 0.75;
  }
  function playerVisMul() {
    if (P.hidden) return 0;
    let m = P.crouch ? 0.55 : 1;
    if (P.running) m *= 1.1;
    return m;
  }

  function wakeUp(e) {
    e.state = 'patrol';
    e.hp = e.boss ? Math.max(1, e.hp) : 3;
    e.stun = 0;
    e.atWp = false; e.path = null;
    investigate(e, e.x + Math.sin(e.a), e.z + Math.cos(e.a));
    e.susp = 0.5;
  }

  function knockDown(e, t, how) {
    if (!isActive(e)) return;
    if (e.boss) {
      e.hp -= 1;
      if (e.hp > 0) {
        AU.sfx.hit();
        showMark(e, '!!', '#ff3b30', 1);
        e.reactT = 1.0;
        if (e.state !== 'alert') spotted(e, P);
        return;
      }
    }
    e.state = 'down';
    e.downT = t;
    e.path = null;
    e.susp = 0;
    e.mark.visible = false;
    G.stats.downs++;
    AU.sfx.takedown();
    makeNoise(e.x, e.z, 2.2, 'thud');
  }

  function enemyShoot(e, target) {
    e.shootT = (e.boss ? 0.6 : 1.05) + Math.random() * 0.5;
    const d = dist(e, target);
    let p = clamp(0.8 - d * 0.045, 0.22, 0.78);
    if (target.crouch) p *= 0.75;
    if (target === G.girl) p *= 0.6;
    const hit = Math.random() < p;
    const mx = e.x + Math.sin(e.a) * 0.5, mz = e.z + Math.cos(e.a) * 0.5;
    if (hit) tracer(mx, mz, target.x, target.z);
    else tracer(mx, mz, target.x + (Math.random() - 0.5) * 2.2, target.z + (Math.random() - 0.5) * 2.2);
    AU.sfx.shot();
    if (!hit) return;
    if (target === P) damage(e.boss ? 11 : 8);
    else damageGirl(e.boss ? 8 : 6);
  }

  function damage(n) {
    if (G.cleared || screen !== 'play') return;
    n *= G.D.dmg;
    P.hp -= n;
    G.stats.damage += n;
    P.regenT = 6;
    P.hurtT = 0.25;
    AU.sfx.hit();
    flash('hurt');
    if (P.hp <= 0) { P.hp = 0; gameOver('dead'); }
  }

  // 女の子のダメージ（主人公と同じく、難易度で軽くなる）
  function damageGirl(n) {
    const g = G.girl;
    if (!g || !G.girlFreed || G.cleared || screen !== 'play') return;
    n *= G.D.dmg;
    g.hp -= n;
    g.regenT = 6;
    g.hurtT = 0.4;
    G.stats.girlDamage = (G.stats.girlDamage || 0) + n;
    AU.sfx.hit();
    flash('hurtGirl');
    if (g.hp <= 0) { g.hp = 0; gameOver('girl'); return; }
    if (g.hp < 40) girlBark('weak', 'tears', 25);
    else girlBark('hurt', 'scared', 9);
  }

  function updateEnemy(e, dt) {
    e.moving = false;
    if (e.markT > 0) { e.markT -= dt; if (e.markT <= 0 && e.state !== 'down') e.mark.visible = false; }

    if (e.state === 'tied') return;
    if (e.state === 'down') {
      e.downT -= dt;
      if (e.downT < 6 && e.downT > 0) showMark(e, 'Zz', '#bfe3ff', 0.2);
      else showMark(e, '★', '#ffe14d', 0.2);
      if (e.downT <= 0) wakeUp(e);
      return;
    }

    // ---- 知覚 ----
    let target = null, best = 0;
    const vp = sees(e, P.x, P.z, playerVisMul(), P.crouch);
    if (vp > 0) { target = P; best = vp; }
    // 主人公が見えているときは主人公を優先（女の子ばかり狙われないように）
    if (!target) {
      for (const f of G.followers) {
        const v = sees(e, f.x, f.z, f.crouch ? 0.5 : 0.85, f.crouch);
        if (v > best) { best = v; target = f; }
      }
    }
    e.seeP = target === P ? vp : 0;

    if (target) {
      G.anySee = true;
      if (G.phase === 'alert' || e.state === 'alert') {
        if (e.state !== 'alert') spotted(e, target);
        G.lastKnown = { x: target.x, z: target.z };
        G.alertT = ALERT_TIME;
      } else {
        e.susp += dt * (0.8 + 3.4 * best) * (G.phase === 'evasion' ? 2.5 : 1);
        if (e.susp >= 1) spotted(e, target);
        else if (e.susp > 0.3 && e.state !== 'investigate') investigate(e, target.x, target.z);
        else if (e.state === 'investigate' && e.susp > 0.3) { e.invPos = { x: target.x, z: target.z }; if ((e.repathT -= dt) <= 0) { e.repathT = 0.6; setPath(e, target.x, target.z); } }
      }
    } else {
      e.susp = Math.max(0, e.susp - dt * 0.22);
    }

    // 倒れた仲間に気づく
    e.bodyT -= dt;
    if (e.bodyT <= 0 && e.state !== 'alert') {
      e.bodyT = 0.35;
      for (const o of G.enemies) {
        if (o === e || isActive(o) || e.seenBodies.has(o.id)) continue;
        if (sees(e, o.x, o.z, 0.85, false) > 0) {
          e.seenBodies.add(o.id);
          investigate(e, o.x, o.z);
          e.bodyTarget = o;
          showMark(e, '!?', '#ffa53a', 2);
          break;
        }
      }
    }

    if (e.reactT > 0) {
      e.reactT -= dt;
      if (target) turnTo(e, Math.atan2(target.x - e.x, target.z - e.z), dt * 6);
      return;
    }

    // ---- 行動 ----
    if (e.state === 'alert') {
      if (G.phase !== 'alert') { e.state = 'search'; e.path = null; return; }
      const tgt = target || null;
      if (tgt) {
        const d = dist(e, tgt);
        turnTo(e, Math.atan2(tgt.x - e.x, tgt.z - e.z), dt * 8);
        if (d > 5.5) {
          e.repathT -= dt;
          if (e.repathT <= 0 || !e.path) { e.repathT = 0.5; setPath(e, tgt.x, tgt.z); }
          follow(e, E_SPEED.run, dt);
          turnTo(e, Math.atan2(tgt.x - e.x, tgt.z - e.z), dt * 8);
        }
        e.shootT -= dt;
        const canHurt = tgt === P || tgt === G.girl;
        if (d < 1.1 && canHurt) {
          if (e.shootT <= 0) { e.shootT = 1.1; AU.sfx.punch(); if (tgt === P) damage(9); else damageGirl(7); }
        } else if (e.shootT <= 0 && canHurt && d < 13) enemyShoot(e, tgt);
      } else {
        // 最後に見た位置へ
        const lk = G.lastKnown;
        e.repathT -= dt;
        if (!e.path && lk && (e.repathT <= 0)) { e.repathT = 0.6; setPath(e, lk.x, lk.z); }
        const arrived = follow(e, E_SPEED.run, dt);
        if (arrived) e.a += dt * 2.4;
        // ロッカーに入るところを見られていたら、引きずり出される
        if (P.hidden && P.hidden.compromised && dist(e, P) < 1.6) {
          exitLocker(true);
          damage(12);
          spotted(e, P);
        }
      }
      return;
    }

    if (e.state === 'search') {
      if (G.phase === 'sneak') { e.state = 'return'; e.path = null; return; }
      if (!e.path) {
        if (e.lookT > 0) { e.lookT -= dt; e.a += dt * 1.8; return; }
        const lk = G.lastKnown || e;
        for (let k = 0; k < 8; k++) {
          const x = Math.floor(lk.x + (Math.random() - 0.5) * 12), z = Math.floor(lk.z + (Math.random() - 0.5) * 12);
          if (!M.solid(x, z)) { setPath(e, x + 0.5, z + 0.5); break; }
        }
      }
      if (follow(e, E_SPEED.search, dt)) e.lookT = 1.5 + Math.random() * 1.5;
      return;
    }

    if (e.state === 'investigate') {
      if (!e.path && e.lookT <= 0 && e.invPos && dist(e, e.invPos) > 0.6) setPath(e, e.invPos.x, e.invPos.z);
      const arrived = follow(e, E_SPEED.inv, dt);
      if (arrived) {
        if (e.bodyTarget) {
          const b = e.bodyTarget;
          e.bodyTarget = null;
          if (b.state === 'down') { b.downT = 0; wakeUp(b); }
        }
        e.lookT += dt;
        e.a += dt * 1.6 * (e.id.length % 2 ? 1 : -1);
        if (e.lookT > 3.5) { e.state = 'return'; e.path = null; e.lookT = 0; e.mark.visible = false; }
      }
      return;
    }

    if (e.state === 'return') {
      const wp = e.route[e.wp];
      if (!e.path) setPath(e, wp.x, wp.z);
      if (follow(e, E_SPEED.walk, dt)) { e.state = 'patrol'; e.atWp = true; e.waitT = wp.wait; }
      return;
    }

    // patrol
    const wp = e.route[e.wp];
    if (e.atWp) {
      e.waitT -= dt;
      if (wp.looks.length) {
        const prog = wp.wait > 0 ? 1 - Math.max(0, e.waitT) / wp.wait : 1;
        const k = Math.min(wp.looks.length - 1, Math.floor(prog * wp.looks.length));
        turnTo(e, wp.looks[k], dt * 2.2);
      }
      if (e.waitT <= 0) {
        if (e.route.length > 1) { e.atWp = false; e.wp = (e.wp + 1) % e.route.length; e.path = null; }
        else e.waitT = wp.wait;
      }
    } else {
      if (!e.path) setPath(e, wp.x, wp.z);
      if (follow(e, E_SPEED.walk, dt)) { e.atWp = true; e.waitT = wp.wait; }
    }
  }

  // ===================== プレイヤー =====================
  function enterLocker(l) {
    P.hidden = l;
    P.crouch = false;
    l.compromised = false;
    P.a = P.camA = l.face;
    P.pitch = 0;
  }
  function exitLocker(forced) {
    const l = P.hidden;
    P.hidden = null;
    // ロッカーの正面に出る
    const fx = l.x + 0.5 + Math.sin(l.face) * 1.0, fz = l.z + 0.5 + Math.cos(l.face) * 1.0;
    if (!collides(fx, fz, R_PLAYER)) { P.x = fx; P.z = fz; }
    P.a = P.camA = l.face;
    if (!forced) AU.sfx.door();
  }

  // 目の前（向いている方向の近く）にいる敵
  function enemyInReach() {
    let near = null, nd = 1.6;
    for (const e of G.enemies) {
      if (!isActive(e)) continue;
      const d = dist(P, e);
      if (d < nd && Math.abs(angDiff(P.a, Math.atan2(e.x - P.x, e.z - P.z))) < 1.3) { near = e; nd = d; }
    }
    return near;
  }
  function isBehind(e) {
    if (e.state === 'alert' && e.seeP > 0) return false;
    const fx = Math.sin(e.a), fz = Math.cos(e.a);
    const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz) || 1;
    const cos = (dx * fx + dz * fz) / d;
    return cos < -0.15 || (e.seeP === 0 && e.state !== 'alert');
  }
  // 殴る：気づかれていなければ一撃で気絶、正面からだと3発
  function punchAction() {
    if (P.hidden) { exitLocker(false); return; }
    if (G.talk || P.actT > 0) return;
    const e = enemyInReach();
    // 目の前に敵がいなければ、近くの人に話しかける
    if (!e) {
      const c = informantNear();
      // 吹き出しが出ているときは、もう一度押すと閉じる（同じ人には何度でも話しかけられ、同じ話をしてくれる）
      if (c && G.say) { G.say = null; hideTalk(); return; }
      if (c) { startTalk(c); return; }
    }
    P.actT = 0.35;
    if (!e) { AU.sfx.throw_(); return; }
    P.a = Math.atan2(e.x - P.x, e.z - P.z);
    if (isBehind(e)) { knockDown(e, e.boss ? 25 : 55, 'cqc'); return; }
    AU.sfx.punch();
    e.hp -= 1;
    showMark(e, '!', '#ff3b30', 0.8);
    if (e.hp <= 0) { if (e.boss) e.hp = 1; knockDown(e, 40, 'punch'); return; }
    e.reactT = 0.4;
    spotted(e, P);
  }
  function freeGirl() {
    const g = G.girl;
    g.freed = true;
    G.girlFreed = true;
    g.heart.visible = false;
    G.followers.unshift(g);
    AU.sfx.free();
    G.stats.freed++;
    if (S.onRescue) S.onRescue(ctx);
    G.talk = null; G.say = null; hideTalk();
    GFX.flash(0xffe2c8, 0.55);
    // 女の子との会話（ステージに用意があれば）。終わったら元の画面に戻る
    if (S.rescueTalk) startCine(S.rescueTalk, () => { screen = 'play'; show('hud'); });
  }
  // 近づくだけで起きること（鍵・手がかりを拾う、女の子を助ける、出口）
  function autoInteract() {
    for (const it of G.items) {
      if (it.taken || Math.hypot(it.x - P.x, it.z - P.z) > 0.9) continue;
      it.taken = true;
      dyn.remove(it.model); dyn.remove(it.glow);
      if (it.type === 'key') { P.inv.key = 1; if (G.girlFreed) girlBark('key', 'relief', 99); }
      if (it.type === S.clueItem) G.clueFound = true;
      AU.sfx.pickup();
    }
    const g = G.girl;
    if (g && !g.freed && dist(P, g) < 1.3) freeGirl();
    // 2人そろって出口に着いたらクリア
    if (G.girlFreed && (!S.key || P.inv.key) && g.hp > 0 && dist(P, g) < 4) {
      for (let i = 0; i < S.exits.length; i++) {
        const ex = S.exits[i];
        if (G.closedExits.has(i) || Math.hypot(P.x - ex.x, P.z - ex.z) > 1.8) continue;
        worldRefs.onExit();
        clear();
        break;
      }
    }
  }

  function updatePlayer(dt) {
    const inp = readInput();
    P.moving = false; P.running = false;
    if (P.actT > 0) P.actT -= dt;
    if (P.hurtT > 0) P.hurtT -= dt;

    if (inp.crouch && !P.hidden) P.crouch = !P.crouch;
    if (inp.action) punchAction();

    // カメラの向き（ドラッグ／マウスで回せる）
    P.camA += look.yaw;
    P.pitch = clamp(P.pitch + look.pitch, -0.6, 0.5);
    look.yaw = look.pitch = 0;
    const mag = Math.min(1, Math.hypot(inp.x, inp.z));
    if (P.hidden) {
      // ロッカーの中：隙間から見える範囲だけ。スティックを倒すと外に出る
      P.camA = P.hidden.face + clamp(angDiff(P.hidden.face, P.camA), -0.7, 0.7);
      P.a = P.camA;
      P.pitch = clamp(P.pitch, -0.3, 0.2);
      if (mag > 0.5) exitLocker(false);
      regen(dt);
      return;
    }
    // 話している間は動けない。スティックを倒すと話をやめる
    if (G.talk) {
      G.talk.t += dt;
      if (mag > 0.5) G.talk = null;
      else if (G.talk.t >= TALK_TIME) finishTalk();
      if (G.talk) { regen(dt); return; }
    }

    if (mag > 0.12 && P.actT <= 0) {
      let speed;
      if (P.crouch) speed = SPEED.crouch;
      else if (inp.run) { speed = SPEED.run; P.running = true; }
      else speed = SPEED.walk * Math.max(0.5, mag);
      // スティックの向きはカメラ基準。主人公は進む方向を向き、カメラはゆっくり背後へ回り込む
      const ix = inp.x / mag, iz = inp.z / mag;
      const ca = Math.cos(P.camA), sa = Math.sin(P.camA);
      const wx = -ca * ix - sa * iz, wz = sa * ix - ca * iz;
      const bx = P.x, bz = P.z;
      moveBy(P, wx * speed * dt, wz * speed * dt, R_PLAYER);
      P.moving = Math.hypot(P.x - bx, P.z - bz) > speed * dt * 0.2;
      const want = Math.atan2(wx, wz);
      P.a += angDiff(P.a, want) * Math.min(1, dt * 12);
      if (iz < 0.3) P.camA += angDiff(P.camA, P.a) * Math.min(1, dt * 1.6 * mag);
      if (P.moving) P.bobT += dt * (P.running ? 13 : P.crouch ? 6 : 9);
    }
    // 敵とぶつからない
    for (const e of G.enemies) {
      const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz);
      if (d < 0.55 && d > 0.001) {
        const push = (0.55 - d);
        moveBy(P, (dx / d) * push, (dz / d) * push, R_PLAYER);
      }
    }
    // 走ると足音
    if (P.running && P.moving) {
      P.noiseT -= dt;
      if (P.noiseT <= 0) { P.noiseT = 0.45; makeNoise(P.x, P.z, 3.6, 'step'); AU.sfx.step(); }
    }
    // 足跡（ついてくる仲間用）
    const last = P.trail[P.trail.length - 1];
    if (!last || Math.hypot(last.x - P.x, last.z - P.z) > 0.25) {
      P.trail.push({ x: P.x, z: P.z });
      if (P.trail.length > 240) P.trail.shift();
    }
    autoInteract();
    regen(dt);
    if (!G.hint.left && M.roomAt(P.x, P.z).id !== S.startRoom) G.hint.left = true;
  }
  function regen(dt) {
    if (P.regenT > 0) { P.regenT -= dt; return; }
    if (G.phase === 'sneak' && P.hp < 100) P.hp = Math.min(100, P.hp + dt * 1.2);
  }

  // ついてくる女の子
  // 主人公の少し後ろを保ち、まっすぐ行けるときは直進、壁や机があるときは経路をたどる。
  // 引っかかったら経路を引き直し、横に避ける。瞬間移動はしない。
  const R_FOLLOW = 0.24;
  function walkable(x0, z0, x1, z1) {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.ceil(d / 0.2));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (collides(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, R_FOLLOW + 0.02)) return false;
    }
    return true;
  }
  function updateFollowers(dt) {
    G.followers.forEach((f, i) => {
      f.moving = false;
      f.speedNow = 0;
      if (f.repathT === undefined) { f.repathT = 0; f.stuckT = 0; f.path = null; f.pathI = 0; }
      const keep = 1.15 + i * 0.75; // 主人公との距離
      const pd = dist(f, P);
      if (pd > keep && !P.hidden) {
        let tx = P.x, tz = P.z;
        if (!walkable(f.x, f.z, P.x, P.z)) {
          f.repathT -= dt;
          if (!f.path || f.repathT <= 0) { f.repathT = 0.45; f.path = findPath(f.x, f.z, P.x, P.z); f.pathI = 0; }
          // 階段で階を移ったら、前の階に残った経路の点は飛ばす
          while (f.path && f.pathI < f.path.length - 1 && !sameFloor(f.path[f.pathI], f)) f.pathI++;
          if (f.path && f.path.length) {
            // 見通せる先のノードまで飛ばして、角を自然に曲がる
            while (f.pathI < f.path.length - 1 && walkable(f.x, f.z, f.path[f.pathI + 1].x, f.path[f.pathI + 1].z)) f.pathI++;
            const n = f.path[Math.min(f.pathI, f.path.length - 1)];
            tx = n.x; tz = n.z;
            if (Math.hypot(n.x - f.x, n.z - f.z) < 0.25) f.pathI++;
          }
        } else f.path = null;
        const dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz) || 1;
        // 離れているほど速く。主人公より少しだけ速く走れるので置いていかれない
        const gap = pd - keep;
        let sp = gap > 3 ? SPEED.run * 1.08 : clamp(gap * 2.2, 0.6, P.running ? SPEED.run * 1.05 : SPEED.walk * 1.15);
        if (P.crouch && gap < 3) sp = Math.min(sp, SPEED.crouch * 1.25);
        const step = Math.min(d, sp * dt);
        const bx = f.x, bz = f.z;
        moveBy(f, (dx / d) * step, (dz / d) * step, R_FOLLOW);
        const moved = Math.hypot(f.x - bx, f.z - bz);
        if (moved < step * 0.3) {
          f.stuckT += dt;
          if (f.stuckT > 0.35) {
            // 横にずれて抜ける
            const side = (Math.floor(G.time * 2) % 2 ? 1 : -1) * step;
            moveBy(f, (-dz / d) * side, (dx / d) * side, R_FOLLOW);
            f.path = null; f.repathT = 0;
          }
        } else f.stuckT = 0;
        f.moving = moved > 0.002;
        f.speedNow = moved / Math.max(dt, 1e-4);
        if (f.moving) f.a += angDiff(f.a, Math.atan2(dx, dz)) * Math.min(1, dt * 10);
      } else if (!f.moving) {
        f.a += angDiff(f.a, Math.atan2(P.x - f.x, P.z - f.z)) * Math.min(1, dt * 3);
      }
      // 主人公やほかの仲間と重ならない
      const sep = (o, r) => {
        const dx = f.x - o.x, dz = f.z - o.z, d = Math.hypot(dx, dz);
        if (d < r && d > 0.001) moveBy(f, (dx / d) * (r - d) * 0.5, (dz / d) * (r - d) * 0.5, R_FOLLOW);
      };
      sep(P, 0.7);
      G.followers.forEach((o) => { if (o !== f) sep(o, 0.55); });
      // しゃがむのは主人公に合わせる。見つかっている間は、止まったら身をかがめる
      f.crouch = P.crouch || !!P.hidden || (G.phase === 'alert' && !f.moving);
      // 女の子の体力は、主人公と同じく見つかっていないときに回復する
      if (f.kind === 'girl') {
        if (f.hurtT > 0) f.hurtT -= dt;
        if (f.regenT > 0) f.regenT -= dt;
        else if (G.phase === 'sneak' && f.hp < 100) f.hp = Math.min(100, f.hp + dt * 1.2);
      }
    });
  }

  // ===================== フェーズ =====================
  function updatePhase(dt) {
    if (G.phase === 'alert') {
      if (!G.anySee) G.alertT -= dt;
      if (G.alertT <= 0) {
        G.phase = 'evasion';
        G.evaT = EVASION_TIME;
        AU.bgm('evasion');
        for (const e of G.enemies) if (e.state === 'alert') { e.state = 'search'; e.path = null; e.lookT = 0; showMark(e, '?', '#ffd23f', 1.5); }
      }
    } else if (G.phase === 'evasion') {
      G.evaT -= dt;
      if (G.evaT <= 0) {
        G.phase = 'sneak';
        if (G.girlFreed) girlBark('calm', 'relief', 40);
        AU.bgm('sneak');
        for (const e of G.enemies) if (e.state === 'search') { e.state = 'return'; e.path = null; }
      }
    }
    G.anySee = false;
  }

  // いちばん近い出口（3D上の距離で比べる。出口はどれも1階）
  function nearestExit() {
    let best = S.exits.find((ex, i) => !G.closedExits.has(i)), bd = 1e9;
    for (let i = 0; i < S.exits.length; i++) {
      const ex = S.exits[i];
      if (G.closedExits.has(i)) continue;
      const d = Math.hypot(M.wx(P.x) - M.wx(ex.x), P.z - ex.z) + (floorOf(P) !== M.floorOf(ex.x) ? 8 : 0);
      if (d < bd) { bd = d; best = ex; }
    }
    return best;
  }
  // 歩く距離がいちばん短い出口（封鎖で遠回りになる出口は選ばない）
  function bestExit() {
    let best = null, bd = 1e9;
    S.exits.forEach((ex, i) => {
      if (G.closedExits.has(i)) return;
      const q = findPath(P.x, P.z, ex.x, ex.z);
      if (q && q.length < bd) { bd = q.length; best = ex; }
    });
    return best;
  }
  // 共通のルール：最初の部屋を出る → 女の子を探す → 助ける →（鍵があれば鍵）→ 2人で出口へ
  function objective() {
    if (!G.hint.left) return S.leave;
    if (!G.girlFreed) {
      if (!G.clueFound && dist(P, G.girl) > 7) {
        // クラスメートから聞いた話があれば、それを並べる
        const hs = G.hints.map((h) => h.short).join('・');
        return { text: S.texts.find + (S.keepSpotHint && hs ? G.spot.hint + '・' + hs : hs || G.spot.hint), pos: null, label: '' };
      }
      // 話を聞いて探すステージでは、居場所への案内（ルート・目印）は出さない
      return { text: S.texts.rescue, pos: S.noGuide ? null : G.girl, label: S.texts.girlLabel };
    }
    if (S.key && !P.inv.key) {
      // 鍵のありかは、誰かに聞くまで分からない（話を聞ける人がいないステージでは最初から案内する）
      if (S.informants && !G.keyHint) return { text: S.key.text + '：' + S.key.ask, pos: null, label: '' };
      return { text: S.key.text, pos: S.noGuide ? null : S.key, label: S.key.label };
    }
    const ex = G.exitPick && !G.closedExits.has(S.exits.indexOf(G.exitPick)) ? G.exitPick : nearestExit();
    return { text: S.exitText, pos: ex, label: ex.label };
  }
  // 画面とレーダーで指す場所。目的地が別の階なら、経路上の階段（エスカレーター）を指す
  function guideTarget() {
    const o = objective();
    if (!o.pos || sameFloor(o.pos, P) || !G.guide) return o;
    const k = G.guide.findIndex((q) => q.portal);
    if (k < 0) return o;
    // 上りは階段・エスカレーターの乗り口（高さが変わり始めるところ）を指す
    const y0 = M.wy(P.x, P.z);
    let j = k;
    while (j > 0 && Math.abs(M.wy(G.guide[j - 1].x, G.guide[j - 1].z) - y0) > 0.05) j--;
    return { text: o.text, pos: G.guide[j], label: M.floorOf(o.pos.x) > floorOf(P) ? '上の階へ' : '下の階へ' };
  }
  // ===================== 入力 =====================
  const keys = {};
  const pressed = { action: false, crouch: false };
  const stick = { id: null, x: 0, z: 0 };
  let runOn = false;
  window.addEventListener('keydown', (e) => {
    if (e.repeat) { if (screen === 'play' && e.code.startsWith('Arrow')) e.preventDefault(); return; }
    keys[e.code] = true;
    if (screen === 'cine' && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE')) { e.preventDefault(); cineNext(); return; }
    if (screen === 'play') {
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyJ') pressed.action = true;
      if (e.code === 'KeyC' || e.code === 'ControlLeft') pressed.crouch = true;
      if (e.code === 'Escape' || e.code === 'KeyP') pause(true);
      if (e.code === 'KeyM' || e.code === 'Tab') { e.preventDefault(); openMap(); }
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    } else if (screen === 'pause' && (e.code === 'Escape' || e.code === 'KeyP')) pause(false);
    else if (screen === 'map') { e.preventDefault(); closeMap(); }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (screen === 'play') pause(true); });

  function readInput() {
    let x = 0, z = 0;
    if (keys.KeyA || keys.ArrowLeft) x -= 1;
    if (keys.KeyD || keys.ArrowRight) x += 1;
    if (keys.KeyW || keys.ArrowUp) z -= 1;
    if (keys.KeyS || keys.ArrowDown) z += 1;
    let run = !!(keys.ShiftLeft || keys.ShiftRight);
    if (stick.id !== null) { x = stick.x; z = stick.z; run = runOn; }
    else if (x || z) { const m = Math.hypot(x, z); x /= m; z /= m; }
    const out = { x, z, run, action: pressed.action, crouch: pressed.crouch };
    pressed.action = pressed.crouch = false;
    return out;
  }

  // アナログスティック（左下に固定。左側のどこを触っても、触った位置で操作できる）
  const stickZone = $('stickZone'), stickBase = $('stickBase'), knob = $('stickKnob');
  const STICK_R = 46;
  function stickAt(e) {
    const r = stickBase.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
    stick.x = dx / STICK_R; stick.z = dy / STICK_R;
    knob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
  }
  stickZone.addEventListener('pointerdown', (e) => {
    if (stick.id !== null) return;
    e.preventDefault();
    stick.id = e.pointerId;
    try { stickZone.setPointerCapture(e.pointerId); } catch (err) { /* 取れなくても動く */ }
    stickBase.classList.add('on');
    stickAt(e);
  });
  stickZone.addEventListener('pointermove', (e) => { if (e.pointerId === stick.id) stickAt(e); });
  const endStick = (e) => {
    if (e.pointerId !== stick.id) return;
    stick.id = null; stick.x = stick.z = 0;
    stickBase.classList.remove('on');
    knob.style.transform = 'translate(-50%, -50%)';
  };
  stickZone.addEventListener('pointerup', endStick);
  stickZone.addEventListener('pointercancel', endStick);

  // 視点：マウス（クリックでポインタロック）／画面右側のドラッグ
  const look = { yaw: 0, pitch: 0 };
  const MOUSE_SENS = 0.0024, TOUCH_SENS = 0.006;
  let mouseDrag = false, wasLocked = false;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || screen !== 'play') return;
    mouseDrag = true;
    if (canvas.requestPointerLock && document.pointerLockElement !== canvas) {
      try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) { /* 使えなければドラッグで操作 */ }
    }
  });
  window.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') mouseDrag = false; });
  window.addEventListener('mousemove', (e) => {
    if (screen !== 'play') return;
    if (document.pointerLockElement === canvas || mouseDrag) {
      look.yaw -= e.movementX * MOUSE_SENS;
      look.pitch -= e.movementY * MOUSE_SENS;
    }
  });
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (!locked && wasLocked && screen === 'play') pause(true);
    wasLocked = locked;
  });
  const lookZone = $('lookZone');
  const lookT = { id: null, x: 0, y: 0 };
  lookZone.addEventListener('pointerdown', (e) => {
    if (lookT.id !== null) return;
    e.preventDefault();
    lookT.id = e.pointerId; lookT.x = e.clientX; lookT.y = e.clientY;
    try { lookZone.setPointerCapture(e.pointerId); } catch (err) { /* 取れなくても動く */ }
  });
  lookZone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookT.id) return;
    look.yaw -= (e.clientX - lookT.x) * TOUCH_SENS;
    look.pitch -= (e.clientY - lookT.y) * TOUCH_SENS;
    lookT.x = e.clientX; lookT.y = e.clientY;
  });
  const endLook = (e) => { if (e.pointerId === lookT.id) lookT.id = null; };
  lookZone.addEventListener('pointerup', endLook);
  lookZone.addEventListener('pointercancel', endLook);

  function bindBtn(id, fn) {
    const b = $(id);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); b.classList.add('down'); fn(); });
    const up = () => b.classList.remove('down');
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  bindBtn('btnA', () => { pressed.action = true; });
  bindBtn('btnC', () => { pressed.crouch = true; });
  bindBtn('btnRun', () => { runOn = !runOn; $('btnRun').classList.toggle('on', runOn); $('btnRun').setAttribute('aria-pressed', String(runOn)); });
  $('btnPause').addEventListener('click', () => pause(true));

  // ===================== HUD =====================
  const hud = {
    life: $('lifeFill'), girlLife: $('girlLife'), girlFill: $('girlFill'), obj: $('obj'), phase: $('phase'), phaseT: $('phaseT'),
    actLabel: $('btnALabel'), crouch: $('btnC'), crouchLabel: $('btnCLabel'),
  };
  let lastHud = {};
  function setText(el, k, v) { if (lastHud[k] !== v) { lastHud[k] = v; el.textContent = v; } }
  function updateHUD(force) {
    if (!G) return;
    if (force) lastHud = {};
    const hp = Math.ceil(P.hp);
    hud.life.style.width = hp + '%';
    hud.life.classList.toggle('low', hp <= 30);
    const g = G.girl;
    hud.girlLife.hidden = !(g && G.girlFreed);
    if (g && G.girlFreed) {
      const gh = Math.ceil(g.hp);
      hud.girlFill.style.width = gh + '%';
      hud.girlFill.classList.toggle('low', gh <= 30);
      hud.girlLife.classList.toggle('low', gh <= 30);
      hud.girlLife.classList.toggle('hit', g.hurtT > 0);
    }
    setText(hud.obj, 'obj', objective().text);
    // フェーズ（文字ではなく、画面の縁の色で知らせる）
    const ph = G.phase;
    if (lastHud.ph !== ph) {
      lastHud.ph = ph;
      hud.phase.className = 'phase ' + ph;
      document.body.dataset.phase = ph;
    }
    if (ph === 'alert') hud.phaseT.textContent = Math.ceil(G.alertT);
    else if (ph === 'evasion') hud.phaseT.textContent = Math.ceil(G.evaT);
    const near = !P.hidden && !G.talk && !enemyInReach() ? informantNear() : null;
    setText(hud.actLabel, 'act', P.hidden ? '出る' : G.talk ? '……' : near ? '話す' : '殴る');
    hud.actLabel.parentElement.classList.toggle('pulse', !!P.hidden || !!(near && hasNews(near)));
    setText(hud.crouchLabel, 'cr', P.crouch ? '立つ' : 'しゃがむ');
    hud.crouch.classList.toggle('on', P.crouch);
    updateSusp();
  }

  // 気づかれかけている方向の表示
  const suspEls = [];
  for (let i = 0; i < 6; i++) { const d = document.createElement('i'); $('susp').appendChild(d); suspEls.push(d); }
  function updateSusp() {
    const list = [];
    for (const e of G.enemies) {
      if (!isActive(e) || dist(P, e) > 26) continue;
      const lvl = e.state === 'alert' ? (e.seeP > 0 ? 1.2 : 0) : e.state === 'investigate' ? Math.max(0.35, e.susp) : e.susp;
      if (lvl > 0.04) list.push([lvl, e]);
    }
    list.sort((a, b) => b[0] - a[0]);
    suspEls.forEach((el, i) => {
      const it = list[i];
      if (!it) { el.hidden = true; return; }
      const [lvl, e] = it;
      const rel = angDiff(P.camA, Math.atan2(e.x - P.x, e.z - P.z));
      const R = Math.min(window.innerWidth, window.innerHeight) * 0.22;
      el.hidden = false;
      el.style.transform = 'translate(' + (-Math.sin(rel) * R) + 'px,' + (-Math.cos(rel) * R) + 'px) rotate(' + (-rel) + 'rad) scale(' + (0.8 + Math.min(1, lvl) * 0.6) + ')';
      el.className = lvl >= 1 ? 'red' : '';
      el.style.opacity = String(0.35 + Math.min(1, lvl) * 0.65);
    });
  }

  // 目的地マーカー（画面上）
  const wpEl = $('wp'), wpArrow = $('wpArrow'), wpLabel = $('wpLabel');
  const wpV = new THREE.Vector3();
  function updateWaypoint() {
    const o = guideTarget();
    if (!o.pos || screen !== 'play') { wpEl.hidden = true; beacon.visible = false; return; }
    beacon.visible = true;
    place(beacon, o.pos.x, o.pos.z, 1.3);
    const dx = M.wx(o.pos.x) - M.wx(P.x), dz = o.pos.z - P.z, d = Math.hypot(dx, dz);
    const W = window.innerWidth, H = window.innerHeight;
    const rel = angDiff(P.camA, Math.atan2(dx, dz));
    const hfov = Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect);
    let sx, sy, edge = 0;
    if (Math.abs(rel) < hfov * 0.92) {
      wpV.set(M.wx(o.pos.x), M.wy(o.pos.x, o.pos.z) + 1.2, o.pos.z).project(camera);
      sx = ((wpV.x + 1) / 2) * W;
      sy = ((1 - wpV.y) / 2) * H;
    } else {
      edge = rel > 0 ? -1 : 1;
      sx = edge < 0 ? 0 : W;
      sy = H * 0.36; // 画面端の矢印は右下のボタンより上に
    }
    sx = clamp(sx, 70, W - 70);
    sy = clamp(sy, 110, H * 0.6);
    wpEl.hidden = false;
    wpEl.style.transform = 'translate(' + sx + 'px,' + sy + 'px)';
    wpArrow.textContent = edge < 0 ? '◀' : edge > 0 ? '▶' : '▼';
    wpLabel.textContent = (o.label || '目的地') + ' ' + Math.round(d) + 'm';
  }

  // レーダー
  const radar = $('radar');
  const rctx = radar.getContext('2d');
  const RS = 5; // 1mあたりのピクセル
  const mapCanvas = document.createElement('canvas');
  // ステージを読み込むたびに描き直す（2階建てなら1階と2階が横並びの1枚になる）
  function drawMap() {
    mapCanvas.width = M.W * RS; mapCanvas.height = M.H * RS;
    const c = mapCanvas.getContext('2d');
    c.fillStyle = '#0b1f17'; c.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
    for (let z = 0; z < M.H; z++) for (let x = 0; x < M.W; x++) {
      const col = M.radarColor(M.get(x, z)) || (M.solid(x, z) ? '#2f6a4b' : null);
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect(x * RS, z * RS, RS, RS);
    }
  }
  function drawRadar(t) {
    const w = radar.width, h = radar.height;
    rctx.save();
    rctx.clearRect(0, 0, w, h);
    rctx.fillStyle = '#06130d';
    rctx.fillRect(0, 0, w, h);
    if (G.phase === 'alert') {
      // ジャミング
      for (let i = 0; i < 260; i++) {
        rctx.fillStyle = 'rgba(120,255,170,' + Math.random() * 0.35 + ')';
        rctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 1 + Math.random() * 2);
      }
      rctx.restore();
      return;
    }
    const scale = w / (28 * RS);
    rctx.translate(w / 2, h / 2);
    rctx.scale(scale, scale);
    rctx.rotate(P.camA - Math.PI); // カメラの向きが上
    rctx.translate(-P.x * RS, -P.z * RS);
    rctx.drawImage(mapCanvas, 0, 0);
    // 目標までのルート（別の階へ移るところまで）
    const o = guideTarget();
    if (G.guide && G.guide.length) {
      rctx.strokeStyle = 'rgba(255,211,77,.85)';
      rctx.lineWidth = RS * 0.4;
      rctx.setLineDash([RS * 0.8, RS * 0.6]);
      rctx.beginPath();
      rctx.moveTo(P.x * RS, P.z * RS);
      for (const q of G.guide) { rctx.lineTo(q.x * RS, q.z * RS); if (q.portal) break; }
      rctx.stroke();
      rctx.setLineDash([]);
    }
    if (o.pos && Math.floor(t * 2) % 2 === 0) {
      rctx.fillStyle = '#ffd34d';
      rctx.beginPath(); rctx.arc(o.pos.x * RS, o.pos.z * RS, RS * 0.9, 0, Math.PI * 2); rctx.fill();
    }
    // 敵
    for (const e of G.enemies) {
      if (e.state === 'tied') { rctx.fillStyle = '#556'; rctx.fillRect(e.x * RS - 3, e.z * RS - 3, 6, 6); continue; }
      if (isActive(e)) {
        const range = enemyRange(e) * RS, fov = enemyFov(e);
        rctx.fillStyle = e.state === 'investigate' ? 'rgba(255,170,60,.35)' : 'rgba(255,240,120,.25)';
        rctx.beginPath();
        rctx.moveTo(e.x * RS, e.z * RS);
        // canvasの角度：0=+x。ゲームの a は +z 基準なので変換
        const ca = Math.PI / 2 - e.a;
        rctx.arc(e.x * RS, e.z * RS, range, ca - fov, ca + fov);
        rctx.closePath(); rctx.fill();
      }
      rctx.fillStyle = isActive(e) ? '#ff4a3a' : '#aa7a70';
      rctx.beginPath(); rctx.arc(e.x * RS, e.z * RS, RS * 0.7, 0, Math.PI * 2); rctx.fill();
    }
    // クラスメートの話から絞れた範囲と、話しかけられる人
    const hr = hintRegion();
    if (hr) {
      rctx.fillStyle = 'rgba(255,211,77,.13)';
      rctx.fillRect(hr.x0 * RS, hr.z0 * RS, (hr.x1 - hr.x0 + 1) * RS, (hr.z1 - hr.z0 + 1) * RS);
    }
    for (const c of G.informants) {
      rctx.fillStyle = hasNews(c) ? '#7fe3ff' : '#5b7a88';
      rctx.beginPath(); rctx.arc(c.x * RS, c.z * RS, RS * 0.6, 0, Math.PI * 2); rctx.fill();
    }
    // 仲間
    rctx.fillStyle = '#ff9ac0';
    for (const f of G.followers) { rctx.beginPath(); rctx.arc(f.x * RS, f.z * RS, RS * 0.5, 0, Math.PI * 2); rctx.fill(); }
    // 自分
    rctx.translate(P.x * RS, P.z * RS);
    rctx.rotate(-P.a + Math.PI);
    rctx.fillStyle = '#ffffff';
    rctx.beginPath(); rctx.moveTo(0, -RS * 1.3); rctx.lineTo(RS * 0.9, RS * 0.9); rctx.lineTo(-RS * 0.9, RS * 0.9); rctx.closePath(); rctx.fill();
    rctx.restore();
    // 方角（地図の上が北。レーダーはカメラの向きで回るので、縁に東西南北を出す）
    {
      const r = P.camA - Math.PI, fs = Math.round(h * 0.12), R0 = w / 2 - fs * 0.75;
      rctx.font = '900 ' + fs + 'px "Zen Kaku Gothic New", sans-serif';
      rctx.textAlign = 'center';
      rctx.textBaseline = 'middle';
      [['北', 0, -1, '#ff7a6a'], ['東', 1, 0, '#d8f5e4'], ['南', 0, 1, '#d8f5e4'], ['西', -1, 0, '#d8f5e4']].forEach(([t, dx, dz, col]) => {
        const sx = dx * Math.cos(r) - dz * Math.sin(r), sy = dx * Math.sin(r) + dz * Math.cos(r);
        const x = w / 2 + sx * R0, y = h / 2 + sy * R0;
        rctx.fillStyle = 'rgba(6,19,13,.75)';
        rctx.beginPath(); rctx.arc(x, y, fs * 0.62, 0, Math.PI * 2); rctx.fill();
        rctx.fillStyle = col;
        rctx.fillText(t, x, y + 1);
      });
      rctx.textAlign = 'left';
    }
    // 今いる階
    if (M.floors > 1) {
      // レーダーは丸く切り抜かれるので、下の中央に出す
      const fs = Math.round(h * 0.15);
      rctx.font = '900 ' + fs + 'px "Zen Kaku Gothic New", sans-serif';
      rctx.fillStyle = 'rgba(6,19,13,.8)';
      rctx.fillRect(w / 2 - fs * 1.05, h - fs * 1.6, fs * 2.1, fs * 1.3);
      rctx.fillStyle = '#ffd34d';
      rctx.textAlign = 'center';
      rctx.textBaseline = 'middle';
      rctx.fillText((floorOf(P) + 1) + 'F', w / 2, h - fs * 0.95);
      rctx.textAlign = 'left';
    }
    if (G.phase === 'evasion') {
      rctx.fillStyle = 'rgba(255,170,60,.12)';
      rctx.fillRect(0, 0, w, h);
    }
  }

  // ===================== 全体マップ（レーダーをタップ） =====================
  // ルートを考えるための地図。敵の位置は出さない（見つかるかどうかは現場で確かめる）
  const bigmap = $('bigmap'), bigC = $('bigmapC');
  function openMap() {
    if (screen !== 'play') return;
    screen = 'map';
    bigmap.hidden = false;
    drawBigMap();
  }
  function closeMap() {
    if (screen !== 'map') return;
    screen = 'play';
    bigmap.hidden = true;
  }
  radar.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); openMap(); });
  bigmap.addEventListener('pointerdown', (e) => { e.preventDefault(); closeMap(); });
  function drawBigMap() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth, H = window.innerHeight;
    bigC.width = Math.round(W * dpr); bigC.height = Math.round(H * dpr);
    const c = bigC.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const padX = 20, top = 34, bottom = 14;
    const k = Math.min((W - padX * 2) / M.W, (H - top - bottom) / M.H);
    const ox = (W - M.W * k) / 2, oy = top + (H - top - bottom - M.H * k) / 2;
    const X = (x) => ox + x * k, Z = (z) => oy + z * k;
    c.imageSmoothingEnabled = false;
    c.drawImage(mapCanvas, ox, oy, M.W * k, M.H * k);
    const dot = (x, z, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(X(x), Z(z), r, 0, Math.PI * 2); c.fill(); };
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    // 階の名前
    if (M.floors > 1) {
      c.font = '900 16px "Zen Kaku Gothic New", sans-serif';
      c.fillStyle = '#ffd34d';
      for (let fl = 0; fl < M.floors; fl++) {
        let x0 = -1;
        for (let x = 0; x < M.W; x++) if (M.wx(x) === 0 && M.floorOf(x) === fl) { x0 = x; break; }
        if (x0 >= 0) c.fillText((fl + 1) + 'F' + (fl === floorOf(P) ? '（いまここ）' : ''), X(x0) + 46, oy - 14);
      }
    }
    // 方角（上が北）
    c.font = '900 15px "Zen Kaku Gothic New", sans-serif';
    [['北', X(M.W / 2), oy - 4, '#ff7a6a'], ['南', X(M.W / 2), Z(M.H) + 9, '#d8f5e4'], ['西', ox - 10, Z(M.H / 2), '#d8f5e4'], ['東', X(M.W) + 10, Z(M.H / 2), '#d8f5e4']]
      .forEach(([t, x, y, col]) => { if (M.floors > 1 && t === '北') return; c.fillStyle = col; c.fillText(t, x, y); });
    {
      // 右上の方位記号
      const cx = W - 30, cy = top + 14;
      c.fillStyle = 'rgba(6,19,13,.8)';
      c.beginPath(); c.arc(cx, cy + 6, 20, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ff7a6a';
      c.beginPath(); c.moveTo(cx, cy - 8); c.lineTo(cx + 6, cy + 8); c.lineTo(cx - 6, cy + 8); c.closePath(); c.fill();
      c.font = '900 11px "Zen Kaku Gothic New", sans-serif';
      c.fillText('北', cx, cy + 17);
      c.font = '900 15px "Zen Kaku Gothic New", sans-serif';
    }
    // ヒントの範囲（どの方角・どの側か分かるように、言葉も添える）
    const hr = hintRegion();
    if (hr) {
      c.fillStyle = 'rgba(255,211,77,.16)';
      c.strokeStyle = 'rgba(255,211,77,.8)';
      c.lineWidth = 2;
      c.fillRect(X(hr.x0), Z(hr.z0), (hr.x1 - hr.x0 + 1) * k, (hr.z1 - hr.z0 + 1) * k);
      c.strokeRect(X(hr.x0), Z(hr.z0), (hr.x1 - hr.x0 + 1) * k, (hr.z1 - hr.z0 + 1) * k);
      const names = (G.girlFreed ? [G.keyHint] : G.hints).filter((h) => h && h.rect).map((h) => h.short).join('・');
      c.fillStyle = '#ffd34d';
      c.font = '900 13px "Zen Kaku Gothic New", sans-serif';
      c.fillText(names, X((hr.x0 + hr.x1 + 1) / 2), Z((hr.z0 + hr.z1 + 1) / 2));
    }
    // 出口（閉じている出口は×）
    c.font = '700 11px "Zen Kaku Gothic New", sans-serif';
    S.exits.forEach((ex, i) => {
      const closed = G.closedExits.has(i);
      if (closed) {
        c.strokeStyle = '#ff4a3a'; c.lineWidth = 3;
        const r = Math.max(5, k * 0.9);
        c.beginPath(); c.moveTo(X(ex.x) - r, Z(ex.z) - r); c.lineTo(X(ex.x) + r, Z(ex.z) + r); c.moveTo(X(ex.x) + r, Z(ex.z) - r); c.lineTo(X(ex.x) - r, Z(ex.z) + r); c.stroke();
      } else dot(ex.x, ex.z, Math.max(5, k * 0.9), '#3ddc84');
      const lx = clamp(X(ex.x), 40, W - 40), lz = clamp(Z(ex.z) + (ex.z > M.H / 2 ? 14 : -14), top - 8, H - 8);
      c.fillStyle = closed ? '#ff8a7a' : '#bff5d4';
      c.fillText(ex.label + (closed ? '（閉鎖）' : ''), lx, lz);
    });
    for (const ci of G.informants) dot(ci.x, ci.z, Math.max(3.5, k * 0.55), hasNews(ci) ? '#7fe3ff' : '#5b7a88');
    // 女の子（居場所が分かっていれば）
    const g = G.girl;
    if (g && (G.girlFreed || (G.clueFound && !S.noGuide))) { c.font = '900 ' + Math.round(Math.max(12, k * 1.6)) + 'px sans-serif'; c.fillStyle = '#ff7aa8'; c.fillText('♥', X(g.x), Z(g.z)); }
    const o = guideTarget();
    if (o.pos) { c.strokeStyle = '#ffd34d'; c.lineWidth = 2; c.beginPath(); c.arc(X(o.pos.x), Z(o.pos.z), Math.max(7, k * 1.3), 0, Math.PI * 2); c.stroke(); }
    // 自分
    c.save();
    c.translate(X(P.x), Z(P.z));
    c.rotate(-P.a + Math.PI);
    const r = Math.max(6, k * 1.1);
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(0, -r * 1.3); c.lineTo(r * 0.9, r * 0.9); c.lineTo(-r * 0.9, r * 0.9); c.closePath(); c.fill();
    c.restore();
  }

  function flash(kind) {
    const el = $('flash');
    el.className = '';
    void el.offsetWidth;
    el.className = kind;
    if (kind === 'hurt') shake = 0.25;
  }

  // ===================== 描画の同期 =====================
  let shake = 0;
  let beacon = null;

  function syncVisuals(dt, t) {
    // 主人公
    const pg = P.model.group;
    pg.visible = !P.hidden && P.camDist > 0.3;
    place(pg, P.x, P.z);
    pg.rotation.y = P.a;
    MD.pose(P.model, P.crouch ? 'crouch' : P.running && P.moving ? 'run' : 'stand', P.moving, dt, P.running ? 12 : P.crouch ? 6 : 8);
    if (P.actT > 0) { P.model.aR.sh.rotation.x = -1.5; P.model.aR.el.rotation.x = -0.2; }
    // 敵
    for (const e of G.enemies) {
      const g = e.model.group;
      place(g, e.x, e.z);
      g.rotation.y = e.a;
      const st = e.state === 'down' ? 'down' : e.state === 'tied' ? 'tied' : 'stand';
      MD.pose(e.model, st === 'stand' && e.moving && e.moveSpeed > 3 ? 'run' : st, e.moving, dt, e.moveSpeed > 3 ? 11 : 7);
      place(e.mark, e.x, e.z, st === 'stand' ? 2.45 : 0.9);
      updateCone(e);
    }
    // 仲間
    for (const f of G.followers) {
      place(f.model.group, f.x, f.z);
      f.model.group.rotation.y = f.a;
      const fast = f.speedNow > 3.2;
      MD.pose(f.model, f.crouch ? 'crouch' : fast ? 'run' : 'stand', f.moving, dt, fast ? 12 : f.crouch ? 6 : 8);
    }
    if (G.girl && !G.girl.freed) {
      G.girl.heart.position.y = M.wy(G.girl.x, G.girl.z) + 1.5 + Math.sin(t * 3) * 0.1;
      G.girl.heart.visible = G.clueFound || dist(P, G.girl) < 7;
    }
    // 座っている人質は、遠くて見えないうちは描かない（壁の向こうの教室など）
    for (const h of G.hostages) h.model.group.visible = sameFloor(h, P) && dist(P, h) < 22;
    for (const c of G.informants) {
      c.mark.visible = hasNews(c) && sameFloor(c, P) && dist(P, c) < 14;
      if (c.mark.visible) place(c.mark, c.x, c.z, 1.45 + Math.sin(t * 3 + c.x) * 0.06);
    }
    // アイテム
    for (const it of G.items) {
      if (it.taken) continue;
      it.model.rotation.y = t * 1.6;
      it.model.position.y = it.base + 0.08 + Math.sin(t * 3 + it.x) * 0.05;
      it.glow.material.opacity = 0.4 + Math.sin(t * 4) * 0.3;
    }
    // パトランプ
    worldRefs.policeLights.forEach((m, i) => { m.visible = (Math.floor(t * 4) + i) % 2 === 0; });
  }
  const tpsLook = new THREE.Vector3();
  // 視点の種類（ポーズ画面で切り替え。端末に保存）
  let camMode = 'low';
  try { camMode = localStorage.getItem('tg-cam') || 'low'; } catch (e) { /* 保存できない環境 */ }
  const camLabel = () => '視点：' + (camMode === 'low' ? '低い' : '高い');
  $('camBtn').textContent = camLabel();
  $('camBtn').addEventListener('click', () => {
    camMode = camMode === 'low' ? 'high' : 'low';
    try { localStorage.setItem('tg-cam', camMode); } catch (e) { /* 保存できない環境 */ }
    $('camBtn').textContent = camLabel();
  });
  function updateCamera(dt) {
    const eye = P.hidden ? 1.45 : P.crouch ? 0.95 : 1.5;
    P.eye += (eye - P.eye) * Math.min(1, dt * 10);
    let x = P.x, z = P.z;
    if (P.hidden) {
      // ロッカーの中、扉の隙間のすぐ後ろ
      x = P.hidden.x + 0.5 + Math.sin(P.hidden.face) * 0.36;
      z = P.hidden.z + 0.5 + Math.cos(P.hidden.face) * 0.36;
    }
    const bob = P.moving ? Math.sin(P.bobT) * (P.running ? 0.05 : 0.025) : 0;
    if (!P.hidden) {
      // 肩越し：右肩の後ろ上から。壁にめり込むときはカメラを手前に寄せる
      const fx = Math.sin(P.camA), fz = Math.cos(P.camA), rx = -Math.cos(P.camA), rz = Math.sin(P.camA);
      // 視点は2種類：low＝主人公の肩のすぐ後ろ・目線に近い高さ、high＝斜め上から見下ろす
      const low = camMode === 'low';
      const want = (low ? 2.15 : 3.2) * Math.cos(P.pitch * 0.5);
      // 肩のずらし幅。戸口などで右側がふさがっているときは、真後ろへ寄せて主人公に近づきすぎないようにする
      const shWant = low ? 0.62 : 0.45;
      const sideFree = (side) => camClip(P.x, P.z, P.x + rx * side - fx * want, P.z + rz * side - fz * want, false);
      const goalSide = low && sideFree(shWant) < 0.7 && sideFree(0) > sideFree(shWant) + 0.15 ? 0 : shWant;
      if (P.camSide === undefined) P.camSide = goalSide;
      P.camSide += (goalSide - P.camSide) * Math.min(1, dt * 5);
      const sh = P.camSide;
      const tx = P.x + rx * sh - fx * want, tz = P.z + rz * sh - fz * want;
      let free = camClip(P.x, P.z, tx, tz, false);
      // ロッカーや棚が背後にあるときは、その上を越えてカメラを置く
      let over = false;
      if (free < 0.5) { const f2 = camClip(P.x, P.z, tx, tz, true); if (f2 > free) { free = f2; over = true; } }
      P.camOver += ((over ? 1 : 0) - P.camOver) * Math.min(1, dt * 6);
      const op = 1 - P.camOver * 0.7;
      worldRefs.occluders.forEach((m) => { const tr = op < 0.99; if (m.transparent !== tr) { m.transparent = tr; m.depthWrite = !tr; m.needsUpdate = true; } m.opacity = op; });
      const d = free * Math.hypot(tx - P.x, tz - P.z);
      P.camDist += (d - P.camDist) * Math.min(1, dt * (d < P.camDist ? 20 : 6));
      const k = P.camDist / Math.max(0.01, Math.hypot(tx - P.x, tz - P.z));
      // 背後が壁で寄りすぎるときは、上から見下ろすように持ち上げる
      const lift = Math.max(0, 1.2 - P.camDist) * 0.9 + P.camOver * 0.7;
      // 屋内は天井の少し下、屋外はもっと高くから見下ろす（高さは今いる階・階段の高さから）
      const base = M.wy(P.x, P.z), top = S.camTop(P.x, P.z);
      const cy = low
        ? base + clamp(1.72 - (P.crouch ? 0.55 : 0) + lift * 0.35 - Math.sin(P.pitch) * 1.0, 0.5, top)
        : base + clamp(top - 0.15 - (P.crouch ? 0.25 : 0) + lift * 0.3 - Math.sin(P.pitch) * 1.4, 0.6, top);
      camera.position.set(M.wx(P.x + (tx - P.x) * k), cy + bob * 0.4, P.z + (tz - P.z) * k);
      // 主人公の少し先（肩の延長線上）を見る。持ち上げたカメラでも主人公が画面に入る
      const L = low ? 5 : 3.6;
      const ly = low ? 1.25 - (P.crouch ? 0.45 : 0) - lift * 0.3 : 0.75 - lift * 0.6;
      // 低い視点ではカメラを右肩の外へずらし、主人公を画面の左寄りに置いて前を見やすくする
      const lk = low ? sh * 0.9 : sh;
      tpsLook.set(M.wx(P.x) + rx * lk + fx * L, base + ly + Math.sin(P.pitch) * L, P.z + rz * lk + fz * L);
    } else {
      P.camDist = 0;
      camera.position.set(M.wx(x), M.wy(x, z) + P.eye + bob, z);
    }
    if (shake > 0) {
      shake -= dt;
      camera.position.x += (Math.random() - 0.5) * shake * 0.3;
      camera.position.y += (Math.random() - 0.5) * shake * 0.3;
    }
    if (!P.hidden) {
      camera.lookAt(tpsLook);
      return;
    }
    const cp = Math.cos(P.pitch);
    camera.lookAt(camera.position.x + Math.sin(P.a) * cp, camera.position.y + Math.sin(P.pitch), camera.position.z + Math.cos(P.a) * cp);
  }

  // 主人公の頭からカメラ位置までの間に壁があれば、手前の割合（0〜1）を返す
  const blocksCam = (x, z, wallsOnly) => (wallsOnly ? M.camWall(x, z) : M.sight(x, z));
  function camClip(x0, z0, x1, z1, wallsOnly) {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.ceil(d / 0.08));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      // 壁ぎりぎりにならないよう、少し太めに判定する
      if (blocksCam(Math.floor(x + 0.18), Math.floor(z), wallsOnly) || blocksCam(Math.floor(x - 0.18), Math.floor(z), wallsOnly) ||
          blocksCam(Math.floor(x), Math.floor(z + 0.18), wallsOnly) || blocksCam(Math.floor(x), Math.floor(z - 0.18), wallsOnly)) {
        return Math.max(0, (i - 1) / n);
      }
    }
    return 1;
  }

  // ===================== 画面遷移 =====================
  function show(id) {
    bigmap.hidden = true;
    ['title', 'hud', 'cine', 'pauseMenu', 'over', 'result'].forEach((k) => { $(k).hidden = k !== id && !(id === 'pauseMenu' && k === 'hud'); });
    document.body.classList.toggle('in-game', id !== 'title');
  }

  let cine = null;
  // ---------- 立ち絵（TG.CAST の人物と表情）。会話シーンと吹き出しの両方で使う ----------
  // 画像が読み込めない人物・表情は、同じ人物の別の表情 → 人物の色のシルエットカード、の順で代わりに出す
  const imgState = {};
  const portraits = [];
  function makeSlot(id) {
    const root = $(id);
    const slot = { root, img: root.querySelector('img'), card: root.querySelector('.pcard'), who: null, face: null };
    slot.img.addEventListener('error', () => { slot.img.hidden = true; slot.card.hidden = false; });
    portraits.push(slot);
    return slot;
  }
  function loadImg(src) {
    if (!src || imgState[src]) return;
    imgState[src] = 'loading';
    const im = new Image();
    im.onload = () => { imgState[src] = 'ok'; portraits.forEach((sl) => { if (sl.who) showPortrait(sl, sl.who, sl.face); }); };
    im.onerror = () => { imgState[src] = 'fail'; portraits.forEach((sl) => { if (sl.who) showPortrait(sl, sl.who, sl.face); }); };
    im.src = src;
  }
  function showPortrait(slot, who, face) {
    const c = TG.CAST[who];
    slot.who = who; slot.face = face;
    slot.root.hidden = !c;
    if (!c) return;
    slot.root.style.setProperty('--pc', c.color);
    let src = TG.castImage(who, face);
    loadImg(src);
    if (imgState[src] !== 'ok') {
      const alt = Object.values(c.faces).find((f) => imgState[f] === 'ok');
      if (alt) src = alt;
    }
    const ok = imgState[src] === 'ok';
    if (ok && slot.img.getAttribute('src') !== src) slot.img.src = src;
    slot.img.hidden = !ok;
    slot.card.hidden = ok;
  }
  function hidePortrait(slot) { slot.who = null; slot.root.hidden = true; }
  // ステージで使う人物の画像を先に読み込んでおく
  function preloadFaces() {
    (S.cast || []).forEach((who) => { const c = TG.CAST[who]; if (c) Object.values(c.faces).forEach(loadImg); });
  }
  const cineSlot = makeSlot('cinePort');
  function startCine(lines, done) {
    cine = { lines, i: -1, done, faces: lines.some((l) => l.who && TG.CAST[l.who]) };
    hidePortrait(cineSlot);
    $('cine').classList.toggle('has-face', cine.faces);
    screen = 'cine';
    show('cine');
    cineNext();
  }
  function cineNext() {
    if (!cine) return;
    cine.i++;
    if (cine.i >= cine.lines.length) { const d = cine.done; cine = null; d(); return; }
    const l = cine.lines[cine.i];
    const who = l.who && TG.CAST[l.who];
    const name = l.w || (who ? who.name : '');
    $('cineWho').textContent = name;
    $('cineWho').hidden = !name;
    $('cineWho').style.color = who ? who.color : '';
    $('cineText').textContent = l.t;
    if (cine.faces) {
      // 話している人の立ち絵を出す。主人公の台詞や地の文の間は、直前の人を少し暗くして残す
      if (who) showPortrait(cineSlot, l.who, l.face);
      cineSlot.root.classList.toggle('dim', !who);
    }
    $('cineCount').textContent = cine.i + 1 + ' / ' + cine.lines.length;
    if (l.fx === 'shake') { shake = 0.6; AU.sfx.door(); AU.sfx.hit(); flash('white'); }
    else AU.sfx.text();
  }
  $('cine').addEventListener('pointerdown', (e) => { if (e.target.id === 'cineSkip') return; cineNext(); });
  $('cineSkip').addEventListener('click', () => { if (cine) { const d = cine.done; cine = null; d(); } });

  function startStage(stageId, diff, quick) {
    AU.init();
    tryLandscape();
    newGame(stageId, diff, quick);
    const begin = () => {
      screen = 'play';
      show('hud');
    };
    // コンティニュー時はオープニングを飛ばす
    if (quick) begin();
    else startCine(S.story.opening.map((l) => (l.riddle ? Object.assign({}, l, { t: G.spot.riddle }) : l)), begin);
  }

  function pause(on) {
    if (on && screen === 'play') { screen = 'pause'; show('pauseMenu'); $('muteBtn').textContent = AU.isMuted() ? '音：OFF' : '音：ON'; }
    else if (!on && screen === 'pause') { screen = 'play'; show('hud'); }
  }

  function gameOver(kind) {
    if (screen !== 'play') return;
    screen = 'over';
    AU.bgm('none');
    AU.sfx.over();
    $('overLine').textContent = kind === 'girl' ? S.over.girl : S.over.dead;
    setTimeout(() => show('over'), 600);
    flash('hurt');
  }

  function clear() {
    if (G.cleared) return;
    G.cleared = true;
    AU.bgm('none');
    AU.sfx.clear();
    screen = 'cine-wait';
    setTimeout(() => startCine(S.story.ending, showResult), 900);
  }

  function rankOf() {
    const s = G.stats, r = S.ranks;
    const fast = G.time < S.par + 60;
    if (s.alerts === 0 && s.downs === 0) return fast ? ['ゴースト', r.ghost] : ['フォックス', r.fox];
    if (s.alerts === 0) return ['フォックス', r.fox];
    if (s.alerts <= 2) return ['ハウンド', r.hound];
    if (s.alerts <= 5) return ['ドッグ', r.dog];
    return ['チキン', r.chicken];
  }
  // 総合ランク（S/A/B/C）：見つかった回数・時間・受けたダメージ・難易度から点数を出す（基準時間はステージごと）
  function gradeOf() {
    const s = G.stats;
    let score = 100;
    score -= s.alerts * 12;
    score -= Math.max(0, G.time - S.par) / 12;
    score -= s.damage * 0.15;
    score -= (s.girlDamage || 0) * 0.2;
    score += { easy: -12, normal: 0, hard: 10 }[G.diff];
    return score >= 90 ? 'S' : score >= 72 ? 'A' : score >= 50 ? 'B' : 'C';
  }
  function fmtTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + '分' + String(s).padStart(2, '0') + '秒'; }

  function showResult() {
    screen = 'result';
    show('result');
    const [code, sub] = rankOf();
    const grade = gradeOf();
    $('resGrade').textContent = grade;
    $('resGrade').className = 'g-' + grade;
    $('resMode').textContent = S.title + '（' + G.D.name + '）　MISSION COMPLETE';
    $('resRank').textContent = code;
    $('resRankSub').textContent = sub;
    const s = G.stats;
    const rows = [['クリアタイム', fmtTime(G.time)], ['見つかった回数', s.alerts + '回'], ['気絶させた数', s.downs + '人'], ['受けたダメージ', Math.round(s.damage)],
      [S.names.girl + 'のダメージ', Math.round(s.girlDamage || 0)]];
    $('resStats').innerHTML = rows.map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>').join('');
    saveBest(S.id + '-' + G.diff, code, G.time, s.alerts, grade);
  }

  // ===================== 記録 =====================
  const RANK_ORDER = ['チキン', 'ドッグ', 'ハウンド', 'フォックス', 'ゴースト'];
  function loadBest() {
    let b = {};
    try { b = JSON.parse(localStorage.getItem('tg-best') || '{}') || {}; } catch (e) { return {}; }
    // 以前の「好きな子を救え」の記録は、学校ステージの記録として引き継ぐ
    for (const k of Object.keys(b)) if (k.startsWith('rescue-') && !b['school-' + k.slice(7)]) b['school-' + k.slice(7)] = b[k];
    return b;
  }
  const GRADE_ORDER = ['C', 'B', 'A', 'S'];
  function saveBest(mode, rank, time, alerts, grade) {
    const b = loadBest();
    const cur = b[mode];
    const better = !cur || GRADE_ORDER.indexOf(grade) > GRADE_ORDER.indexOf(cur.grade || 'C') ||
      (grade === (cur.grade || 'C') && (RANK_ORDER.indexOf(rank) > RANK_ORDER.indexOf(cur.rank) || (rank === cur.rank && time < cur.time)));
    if (better) b[mode] = { rank, time, alerts, grade };
    try { localStorage.setItem('tg-best', JSON.stringify(b)); } catch (e) { /* 保存できなくても続行 */ }
  }

  // ===================== タイトル =====================
  function buildTitle() {
    const best = loadBest();
    const grid = $('modes');
    grid.innerHTML = '';
    Object.values(TG.STAGES).sort((a, b) => a.order - b.order).forEach((m) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mode';
      const cleared = Object.keys(TG.DIFFS).filter((d) => best[m.id + '-' + d]).map((d) => TG.DIFFS[d].name);
      const rec = cleared.length ? '<span class="mode-best">クリア済み：' + cleared.join('・') + '</span>' : '';
      b.innerHTML = '<span class="mode-kind">' + m.place + '</span><span class="mode-name">' + m.title + '</span><span class="mode-hint">' + m.desc + '</span><span class="mode-goal">' + m.goal + '</span>' + rec;
      b.addEventListener('click', () => pickDiff(m));
      grid.appendChild(b);
    });
  }
  // ステージを選んだあとに難易度を選ぶ
  function pickDiff(m) {
    const best = loadBest();
    $('diffStory').textContent = m.title;
    const box = $('diffs');
    box.innerHTML = '';
    Object.entries(TG.DIFFS).forEach(([id, d]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'diff diff-' + id;
      const rec = best[m.id + '-' + id];
      b.innerHTML = '<span class="diff-name">' + d.name + '</span><span class="diff-count">テロリスト ' + m.lists[id].length + '人</span>' +
        (rec ? '<span class="diff-best">' + (rec.grade ? 'ランク' + rec.grade + '／' : '') + rec.rank + '</span>' : '');
      b.addEventListener('click', () => { $('diffPick').hidden = true; startStage(m.id, id); });
      box.appendChild(b);
    });
    $('diffPick').hidden = false;
  }
  $('diffBack').addEventListener('click', () => { $('diffPick').hidden = true; });
  function toTitle() {
    screen = 'title';
    AU.bgm('none');
    buildTitle();
    show('title');
    G = null;
    scene.remove(dyn);
    dyn = new THREE.Group();
    scene.add(dyn);
  }
  function tryLandscape() {
    if (!isTouch) return;
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    try {
      const p = req && !document.fullscreenElement ? req.call(el) : null;
      const so = window.screen.orientation;
      const lock = () => { if (so && so.lock) so.lock('landscape').catch(() => {}); };
      if (p && p.then) p.then(lock).catch(() => {}); else lock();
    } catch (e) { /* 非対応なら何もしない */ }
  }

  $('resume').addEventListener('click', () => pause(false));
  $('restart').addEventListener('click', () => { startStage(G.stage, G.diff, true); });
  $('quitBtn').addEventListener('click', toTitle);
  $('qualityBtn').addEventListener('click', () => { $('qualityBtn').textContent = '画質：' + GFX.cycleQuality(); });
  $('qualityBtn').textContent = '画質：' + GFX.qualityLabel;
  $('muteBtn').addEventListener('click', () => { AU.setMuted(!AU.isMuted()); $('muteBtn').textContent = AU.isMuted() ? '音：OFF' : '音：ON'; });
  $('continueBtn').addEventListener('click', () => { startStage(G.stage, G.diff, true); });
  $('overTitle').addEventListener('click', toTitle);
  $('resRetry').addEventListener('click', () => { startStage(G.stage, G.diff); });
  $('resTitle').addEventListener('click', toTitle);

  // ===================== メインループ =====================
  let lastT = performance.now();
  let hudT = 0;
  // タイトル背景用のカメラ
  const titleCam = { a: 0 };
  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    const t = now / 1000;
    if (screen === 'play' && G) {
      G.time += dt;
      updatePlayer(dt);
      for (const e of G.enemies) updateEnemy(e, dt);
      updateFollowers(dt);
      updatePhase(dt);
      updateFx(dt);
      if (S.tick) S.tick(ctx, dt);
      updateTalkUI(dt);
      G.guideT -= dt;
      if (G.guideT <= 0) {
        G.guideT = 0.5;
        if (G.girlFreed && (!S.key || P.inv.key)) {
          G.exitPick = bestExit();
          if (G.exitPick && Math.hypot(M.wx(P.x) - G.exitPick.x, P.z - G.exitPick.z) < 12 && sameFloor(P, G.exitPick)) girlBark('exit', 'relief', 999);
        }
        const o = objective();
        G.guide = o.pos ? findPath(P.x, P.z, o.pos.x, o.pos.z) : null;
      }
      updateWaypoint();
      hudT -= dt;
      if (hudT <= 0) { hudT = 0.08; updateHUD(false); drawRadar(t); }
    } else if (G && (screen === 'cine' || screen === 'cine-wait' || screen === 'over')) {
      updateFx(dt);
    }
    document.body.classList.toggle('in-locker', !!(G && P.hidden && screen !== 'title'));
    if (G) {
      syncVisuals(screen === 'play' || screen === 'cine' ? dt : 0, t);
      updateCamera(dt);
    } else {
      // タイトル：舞台の上空をゆっくり回る
      const tc = S.titleCam;
      titleCam.a += dt * 0.06;
      camera.position.set(tc.x + Math.sin(titleCam.a) * tc.r, tc.h, tc.z + Math.cos(titleCam.a) * tc.r);
      camera.lookAt(tc.x, 0, tc.z);
      worldRefs.policeLights.forEach((m, i) => { m.visible = (Math.floor(t * 4) + i) % 2 === 0; });
    }
    if (worldRefs.update) worldRefs.update(t, dt);
    // 画面の演出：見つかった・危険・会話中・2人でいる
    const fxT = GFX.fx;
    fxT.alert = G && screen === 'play' && G.phase === 'alert' ? 1 : 0;
    fxT.danger = G && screen === 'play' && (P.hp < 35 || (G.girlFreed && G.girl.hp < 35)) ? 1 : 0;
    fxT.dim = screen === 'cine' || screen === 'map' ? 1 : 0;
    fxT.warm = G && G.girlFreed ? 0.6 : 0;
    if (G) GFX.setFocus(M.wx(P.x), M.wy(P.x, P.z), P.z);
    else GFX.setFocus(S.titleCam.x, 0, S.titleCam.z);
    GFX.render(dt, t);
    requestAnimationFrame(frame);
  }

  // レーダーの解像度
  function sizeRadar() {
    const r = radar.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    radar.width = Math.round(r.width * dpr) || 150;
    radar.height = Math.round(r.height * dpr) || 150;
  }
  window.addEventListener('resize', sizeRadar);

  loadStage('school');
  buildTitle();
  show('title');
  requestAnimationFrame((n) => { lastT = n; sizeRadar(); frame(n); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'play') pause(true); });
  // HUD表示後にレーダーのサイズを合わせる
  new ResizeObserver(sizeRadar).observe(radar);

  TG.debug = { get G() { return G; }, get P() { return P; }, get screen() { return screen; }, startStage, cineNext, clear: () => clear(), findPath, moveBy, setSpot: (i) => { lastSpot[S.id] = i; }, get S() { return S; } };
})();
