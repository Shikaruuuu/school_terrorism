// 〇〇にテロリスト — ステージ「ショッピングモール」
// 2階建て。ゲーム上は「1階」と「2階」をひとつのグリッドに横並びで置き（2階は x を OFF だけずらす）、
// 階段・エスカレーターの端にある「ポータル」のマスに入ると、同じ見た目の位置のまま上下の階へ移る。
// 3Dの表示では 2階の x を戻し、高さを FLOOR_H 上げる。階段の上では高さをなめらかに補間する。
window.TG = window.TG || {};
TG.STAGES = TG.STAGES || {};

(function () {
  const FW = 56, FH = 40; // 1フロアの大きさ
  const OFF = 60; // 2階のグリッド上のずらし幅（間の4列は通れない壁）
  const W = OFF + FW, H = FH;
  const FLOOR_H = 4.5;

  const T = { FLOOR: 1, WALL: 2, SHELF: 3, LOW: 4, VOID: 5, STAIR: 6, PORTAL: 7, EXIT: 8, GAP: 9, RAIL: 10, LOCKER: 11, SHUT: 12, BAR: 13 };
  const SOLID = new Set([T.WALL, T.SHELF, T.LOW, T.VOID, T.GAP, T.RAIL, T.LOCKER, T.SHUT, T.BAR]);
  const SIGHT = new Set([T.WALL, T.SHELF, T.GAP, T.LOCKER, T.SHUT]);
  const LOW = new Set([T.LOW, T.RAIL, T.BAR]);

  const grid = new Uint8Array(W * H).fill(T.GAP);
  const deco = new Uint8Array(W * H); // 家具の見た目（DECO の番号）
  const floorCol = new Uint32Array(W * H); // 床の色
  const portal = new Int32Array(W * H).fill(-1);
  const rooms = [];
  const lockers = [];

  const DECO = { NONE: 0, SHELF: 1, TABLE: 2, COUNTER: 3, SEAT: 4, BED: 5, SOFA: 6, PIANO: 7, MACHINE: 8, RACK: 9, PLANTER: 10, FOUNTAIN: 11, BOOTH: 12, BOARD: 13, SHOWCASE: 14, TV: 15, BOOK: 16 };

  const inB = (x, z) => x >= 0 && z >= 0 && x < W && z < H;
  const idx = (x, z) => z * W + x;
  const get = (x, z) => (inB(x, z) ? grid[idx(x, z)] : T.WALL);

  // 階ごとに書くためのヘルパ（lx は階の中での x）
  let FL = 0;
  const X = (lx) => lx + FL * OFF;
  const set = (lx, z, t, d) => { const x = X(lx); if (!inB(x, z)) return; grid[idx(x, z)] = t; deco[idx(x, z)] = d || 0; };
  const rect = (x0, z0, x1, z1, t, d) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) set(x, z, t, d); };
  const paint = (x0, z0, x1, z1, c) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) floorCol[idx(X(x), z)] = c; };
  const hwall = (x0, x1, z) => rect(x0, z, x1, z, T.WALL);
  const vwall = (x, z0, z1) => rect(x, z0, x, z1, T.WALL);
  const C = (lx, z, fl) => ({ x: lx + (fl || 0) * OFF + 0.5, z: z + 0.5 });

  // 店：名前は「1F カフェ」のようにレーダー・現在地に出る。sign は看板の位置
  const STORES = [];
  function store(id, name, x0, z0, x1, z1, col, sign) {
    rooms.push({ id: id + FL, name: (FL ? '2F ' : '1F ') + name, x0: X(x0), z0, x1: X(x1), z1 });
    paint(x0, z0, x1, z1, col);
    STORES.push({ fl: FL, name, sign, x0: X(x0), z0, x1: X(x1), z1 });
  }

  // ---------------- 両方の階に共通の骨組み ----------------
  function shell() {
    rect(0, 0, FW - 1, FH - 1, T.FLOOR);
    paint(0, 0, FW - 1, FH - 1, 0xd9d4ca);
    hwall(0, FW - 1, 0); hwall(0, FW - 1, FH - 1); vwall(0, 0, FH - 1); vwall(FW - 1, 0, FH - 1);
    // バックヤード（北の細い通路）
    paint(1, 1, 54, 2, 0x8d9093);
    hwall(1, 54, 3);
    // 北の店（z 4〜11）
    [14, 27, 41].forEach((x) => vwall(x, 3, 12));
    hwall(1, 54, 12);
    [[6, 8], [19, 21], [33, 35], [47, 49]].forEach(([a, b]) => rect(a, 12, b, 12, T.FLOOR));
    // 中央の帯：西の店・東の店（z 18〜23）
    hwall(1, 14, 17); hwall(1, 14, 24); vwall(14, 17, 24); rect(14, 20, 14, 21, T.FLOOR);
    hwall(41, 54, 17); hwall(41, 54, 24); vwall(41, 17, 24); rect(41, 20, 41, 21, T.FLOOR);
    // 南の店（z 30〜38）
    hwall(1, 54, 29);
    [14, 25, 30, 41].forEach((x) => vwall(x, 29, 38));
    [[6, 8], [19, 21], [34, 36], [47, 49]].forEach(([a, b]) => rect(a, 29, b, 29, T.FLOOR));
    rect(26, 29, 29, 29, T.FLOOR); // 中央（1階は正面入口ホール、2階はラウンジ）
  }

  // ---------------- 1階 ----------------
  FL = 0;
  shell();
  // バックヤードの裏口
  [[11, 12], [20, 21], [34, 35], [42, 43]].forEach(([a, b]) => rect(a, 3, b, 3, T.FLOOR));
  // 出入口：西・東の非常口、北の搬入口、南の正面入口
  rect(0, 14, 0, 15, T.EXIT); rect(55, 26, 55, 27, T.EXIT); rect(40, 0, 41, 0, T.EXIT); rect(26, 39, 29, 39, T.EXIT);
  // 吹き抜けの広場（噴水）
  paint(20, 17, 35, 24, 0xe6e1d6);
  rect(26, 19, 29, 22, T.LOW, DECO.FOUNTAIN);
  // フロアガイド（案内板）
  set(26, 15, T.LOW, DECO.BOARD); set(29, 26, T.LOW, DECO.BOARD);
  // 店
  store('sport', 'スポーツ用品', 1, 4, 13, 11, 0x9aa6b0, [7, 12.6]);
  rect(2, 6, 5, 6, T.SHELF, DECO.SHELF); rect(8, 6, 10, 6, T.SHELF, DECO.SHELF);
  rect(2, 8, 5, 8, T.SHELF, DECO.SHELF); rect(8, 8, 12, 8, T.SHELF, DECO.SHELF);
  store('cafe', 'カフェ', 15, 4, 26, 11, 0xa57a52, [20, 12.6]);
  rect(16, 5, 19, 5, T.LOW, DECO.COUNTER);
  [[17, 7], [20, 7], [23, 7], [17, 9], [23, 9]].forEach(([x, z]) => set(x, z, T.LOW, DECO.TABLE));
  store('goods', '雑貨', 28, 4, 40, 11, 0xc9b99a, [34, 12.6]);
  [30, 33, 37].forEach((x) => rect(x, 5, x, 9, T.SHELF, DECO.SHELF));
  store('super', 'スーパー', 42, 4, 54, 11, 0xd2d6d0, [48, 12.6]);
  [44, 46, 48, 50, 52].forEach((x) => rect(x, 5, x, 9, T.SHELF, DECO.SHELF));
  store('apparel', 'アパレル', 1, 18, 13, 23, 0xb7a08a, [14.6, 20.5]);
  rect(3, 18, 3, 19, T.SHELF, DECO.BOOTH); rect(3, 22, 3, 23, T.SHELF, DECO.BOOTH);
  rect(5, 19, 7, 19, T.LOW, DECO.RACK); rect(5, 22, 7, 22, T.LOW, DECO.RACK);
  rect(9, 19, 11, 19, T.LOW, DECO.RACK); rect(9, 22, 11, 22, T.LOW, DECO.RACK);
  store('electro', '家電', 42, 18, 54, 23, 0xbfc5ca, [40.4, 20.5]);
  rect(44, 19, 47, 19, T.SHELF, DECO.TV); rect(50, 19, 53, 19, T.SHELF, DECO.TV);
  rect(44, 22, 47, 22, T.SHELF, DECO.TV); rect(50, 22, 53, 22, T.SHELF, DECO.TV);
  store('drug', 'ドラッグストア', 1, 30, 13, 38, 0xe3e6e8, [7, 28.4]);
  [3, 6, 9, 12].forEach((x) => rect(x, 32, x, 36, T.SHELF, DECO.SHELF));
  store('shoes', '靴', 15, 30, 24, 38, 0xb08c68, [20, 28.4]);
  rect(15, 33, 15, 37, T.SHELF, DECO.SHELF);
  [[17, 32], [21, 32], [17, 35], [21, 35]].forEach(([x, z]) => rect(x, z, x + 1, z, T.LOW, DECO.SHOWCASE));
  set(24, 36, T.LOCKER); lockers.push({ x: 24, z: 36, face: -Math.PI / 2 });
  rooms.push({ id: 'hall', name: '1F 正面入口', x0: 26, z0: 30, x1: 29, z1: 38 });
  store('flower', '花屋', 31, 30, 40, 38, 0x9fb08a, [35, 28.4]);
  [[33, 32], [37, 32], [33, 36], [37, 36]].forEach(([x, z]) => rect(x, z, x + 1, z + 1, T.LOW, DECO.PLANTER));
  store('bakery', 'ベーカリー', 42, 30, 54, 38, 0xc49a6c, [48, 28.4]);
  rect(44, 33, 52, 33, T.LOW, DECO.COUNTER);
  [[45, 36], [48, 36], [51, 36]].forEach(([x, z]) => set(x, z, T.LOW, DECO.TABLE));

  // エスカレーター A（西）：南から北へ上る。B（東）：北から南へ上る
  rect(22, 17, 23, 24, T.STAIR); rect(21, 17, 21, 24, T.RAIL); rect(24, 17, 24, 24, T.RAIL);
  rect(22, 16, 23, 16, T.PORTAL); set(21, 16, T.RAIL); set(24, 16, T.RAIL); rect(22, 15, 23, 15, T.LOW, DECO.PLANTER);
  rect(32, 17, 33, 24, T.STAIR); rect(31, 17, 31, 24, T.RAIL); rect(34, 17, 34, 24, T.RAIL);
  rect(32, 25, 33, 25, T.PORTAL); set(31, 25, T.RAIL); set(34, 25, T.RAIL); rect(32, 26, 33, 26, T.LOW, DECO.PLANTER);
  // 非常階段：バックヤードの西端と東端
  rect(3, 1, 10, 2, T.STAIR); rect(2, 1, 2, 2, T.PORTAL); rect(1, 1, 1, 2, T.WALL);
  rect(45, 1, 52, 2, T.STAIR); rect(53, 1, 53, 2, T.PORTAL); rect(54, 1, 54, 2, T.WALL);

  // ---------------- 2階 ----------------
  FL = 1;
  shell();
  [[11, 12], [20, 21], [34, 35], [42, 43]].forEach(([a, b]) => rect(a, 3, b, 3, T.FLOOR));
  // 階段の踊り場から北の店へ抜ける扉
  rect(1, 3, 2, 3, T.FLOOR); rect(53, 3, 54, 3, T.FLOOR);
  // 吹き抜け（落ちないよう手すり）。エスカレーターの上端だけ通れる
  rect(20, 17, 35, 24, T.VOID);
  rect(22, 17, 23, 17, T.PORTAL); rect(32, 24, 33, 24, T.PORTAL);
  // 階段の吹き抜け
  rect(4, 1, 10, 2, T.VOID); rect(3, 1, 3, 2, T.PORTAL);
  rect(45, 1, 51, 2, T.VOID); rect(52, 1, 52, 2, T.PORTAL);
  set(26, 15, T.LOW, DECO.BOARD); set(29, 26, T.LOW, DECO.BOARD);
  store('books', '書店', 1, 4, 13, 11, 0x9c7a56, [7, 12.6]);
  [3, 5, 7, 9, 11].forEach((x) => rect(x, 5, x, 9, T.SHELF, DECO.BOOK));
  store('toys', 'おもちゃ', 15, 4, 26, 11, 0xd8c070, [20, 12.6]);
  rect(16, 6, 19, 6, T.SHELF, DECO.SHELF); rect(22, 6, 25, 6, T.SHELF, DECO.SHELF);
  rect(17, 9, 18, 9, T.LOW, DECO.SHOWCASE); rect(22, 9, 23, 9, T.LOW, DECO.SHOWCASE);
  store('acc', 'アクセサリー', 28, 4, 40, 11, 0xe3d6da, [34, 12.6]);
  [[30, 6], [35, 6], [30, 9], [35, 9]].forEach(([x, z]) => rect(x, z, x + 2, z, T.LOW, DECO.SHOWCASE));
  store('cinema', 'シネマ', 42, 4, 54, 11, 0x3a2430, [48, 12.6]);
  [6, 8].forEach((z) => { rect(44, z, 47, z, T.LOW, DECO.SEAT); rect(49, z, 52, z, T.LOW, DECO.SEAT); });
  store('interior', 'インテリア', 1, 18, 13, 23, 0xbfae94, [14.6, 20.5]);
  [[2, 19], [6, 19], [10, 19]].forEach(([x, z]) => rect(x, z, x + 1, z + 1, T.LOW, DECO.BED));
  rect(3, 22, 5, 22, T.LOW, DECO.SOFA); rect(8, 22, 10, 22, T.LOW, DECO.SOFA);
  store('arcade', 'ゲームセンター', 42, 18, 54, 23, 0x2a2440, [40.4, 20.5]);
  [[44, 45], [48, 49], [52, 53]].forEach(([a, b]) => { rect(a, 19, b, 19, T.SHELF, DECO.MACHINE); rect(a, 22, b, 22, T.SHELF, DECO.MACHINE); });
  store('music', '楽器', 1, 30, 13, 38, 0xa58a6a, [7, 28.4]);
  [[3, 32], [8, 32], [3, 36], [8, 36]].forEach(([x, z]) => rect(x, z, x + 1, z + 1, T.LOW, DECO.PIANO));
  store('glasses', 'メガネ', 15, 30, 24, 38, 0xd8dde2, [20, 28.4]);
  [[17, 33], [21, 33], [17, 36], [21, 36]].forEach(([x, z]) => rect(x, z, x + 1, z, T.LOW, DECO.SHOWCASE));
  rooms.push({ id: 'lounge', name: '2F ラウンジ', x0: X(26), z0: 30, x1: X(29), z1: 38 });
  rect(27, 33, 28, 33, T.LOW, DECO.SOFA); rect(27, 36, 28, 36, T.LOW, DECO.SOFA);
  store('rest', 'レストラン', 31, 30, 40, 38, 0x8a5a44, [35, 28.4]);
  [[33, 32], [36, 32], [39, 32], [33, 35], [36, 35], [39, 35]].forEach(([x, z]) => set(x, z, T.LOW, DECO.TABLE));
  store('food', 'フードコート', 42, 30, 54, 38, 0xd9c9a8, [48, 28.4]);
  rect(43, 38, 53, 38, T.LOW, DECO.COUNTER);
  [[44, 32], [47, 32], [50, 32], [53, 32], [44, 35], [47, 35], [50, 35]].forEach(([x, z]) => set(x, z, T.LOW, DECO.TABLE));

  // ---------------- 階のつなぎ（ポータル） ----------------
  // 1階の「上り口の先」→ 2階の同じ位置、2階の「下り口」→ 1階の同じ位置（階段のいちばん上）
  const link = (lx, z, toFl) => { portal[idx(lx + (1 - toFl) * OFF, z)] = idx(lx + toFl * OFF, z); };
  [[22, 16], [23, 16], [32, 25], [33, 25], [2, 1], [2, 2], [53, 1], [53, 2]].forEach(([x, z]) => link(x, z, 1));
  [[22, 17], [23, 17], [32, 24], [33, 24], [3, 1], [3, 2], [52, 1], [52, 2]].forEach(([x, z]) => link(x, z, 0));

  // 階段の高さ：1階の階段のマスで、上り口に近いほど高い
  const STAIRS = [
    { x0: 22, x1: 24, z0: 17, z1: 25, axis: 'z', low: 25, high: 17 },
    { x0: 32, x1: 34, z0: 17, z1: 25, axis: 'z', low: 17, high: 25 },
    { x0: 3, x1: 11, z0: 1, z1: 3, axis: 'x', low: 11, high: 3 },
    { x0: 45, x1: 53, z0: 1, z1: 3, axis: 'x', low: 45, high: 53 },
  ];
  function stairY(x, z) {
    for (const s of STAIRS) {
      if (x < s.x0 || x >= s.x1 || z < s.z0 || z >= s.z1) continue;
      const v = s.axis === 'z' ? z : x;
      return FLOOR_H * Math.max(0, Math.min(1, (v - s.low) / (s.high - s.low)));
    }
    return 0;
  }

  const solid = (x, z) => SOLID.has(get(x, z));
  const sight = (x, z) => SIGHT.has(get(x, z));
  const low = (x, z) => LOW.has(get(x, z));
  const floorOf = (x) => (x >= OFF - 2 ? 1 : 0);
  function roomAt(x, z) {
    const cx = Math.floor(x), cz = Math.floor(z);
    for (const r of rooms) if (cx >= r.x0 && cx <= r.x1 && cz >= r.z0 && cz <= r.z1) return r;
    const fl = floorOf(x);
    if (cz <= 2) return { id: 'svc' + fl, name: (fl ? '2F' : '1F') + ' バックヤード' };
    return { id: 'concourse' + fl, name: (fl ? '2F' : '1F') + ' 通路' };
  }

  const map = {
    W, H, T, grid, deco, floorCol, rooms, lockers, get, solid, sight, low, roomAt,
    floors: 2, portal, floorOf,
    wx: (x) => (x >= OFF - 2 ? x - OFF : x),
    wy: (x, z) => (x >= OFF - 2 ? FLOOR_H : stairY(x, z)),
    camWall: (x, z) => { const t = get(x, z); return t === T.WALL || t === T.GAP; },
    radarColor: (t) => (t === T.SHUT ? '#ff5a3c' : t === T.BAR ? '#ffb02e' : t === T.WALL ? '#8fe0b0' : t === T.SHELF || t === T.LOCKER ? '#5fae82' : t === T.LOW || t === T.RAIL ? '#2f6a4b' : t === T.VOID ? '#04100a' : t === T.STAIR ? '#3d7a5c' : t === T.EXIT ? '#ffd34d' : t === T.GAP ? '#06130d' : null),
  };

  // ======================= 3D =======================
  function build(group) {
    const MT = TG.mat;
    const { merge, inst, cv, B, CY } = MT;
    const add = (m) => { if (m) group.add(m); return m; };
    const list = (pred) => {
      const out = [];
      for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (pred(get(x, z), x, z)) out.push({ x, z, t: get(x, z), d: deco[idx(x, z)] });
      return out;
    };
    const fy = (x) => (x >= OFF ? FLOOR_H : 0);
    const wxc = (x) => map.wx(x) + 0.5;
    const FONT = '"Zen Kaku Gothic New", "Hiragino Sans", sans-serif';
    const storeAt = (x, z) => STORES.find((s) => x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1);

    // ===================== 外：駐車場・パトカー・まわりの街 =====================
    const asph = MT.surface('asphalt');
    const ground = add(new THREE.Mesh(new THREE.PlaneGeometry(260, 260), asph));
    ground.rotation.x = -Math.PI / 2; ground.position.set(FW / 2, -0.06, FH / 2); ground.receiveShadow = true;
    inst(group, B(0.12, 0.01, 5), MT.plain(0xe8e4d8, 0.6), Array.from({ length: 16 }, (_, i) => i), (o, i) => { o.position.set(4 + i * 3.2, -0.045, FH + 6); }, 'receive');
    const lights = [];
    const carBody = MT.plain(0xf2f2f2, 0.25, 0.3), carDark = MT.plain(0x101214, 0.2, 0.4);
    const car = (x, z, rot) => {
      const g = new THREE.Group();
      const part = (w, h, d, m, y, zz) => { const p = new THREE.Mesh(B(w, h, d), m); p.position.set(0, y, zz); p.castShadow = true; g.add(p); };
      part(1.8, 0.55, 4.2, carBody, 0.55, 0); part(1.82, 0.32, 4.22, carDark, 0.36, 0); part(1.62, 0.5, 2.1, carDark, 1.05, -0.2);
      const r = new THREE.Mesh(B(0.42, 0.16, 0.3), MT.glow(0xff1a10, 5)); r.position.set(-0.3, 1.38, -0.2);
      const b = new THREE.Mesh(B(0.42, 0.16, 0.3), MT.glow(0x1a40ff, 5)); b.position.set(0.3, 1.38, -0.2);
      g.add(r, b); lights.push(r, b);
      g.position.set(x, 0, z); g.rotation.y = rot; group.add(g);
    };
    car(22, FH + 5, Math.PI / 2.3); car(34, FH + 5.5, -Math.PI / 2.2); car(-5, 15, 0.1); car(FW + 5, 27, -0.1);
    const cityWin = cv(128, 256, (x, w, h) => { x.fillStyle = '#1a1e26'; x.fillRect(0, 0, w, h); for (let r = 0; r < 16; r++) for (let c = 0; c < 8; c++) if (Math.random() < 0.4) { x.fillStyle = Math.random() < 0.6 ? '#ffd890' : '#cfe0ff'; x.fillRect(c * 16 + 4, r * 16 + 4, 8, 9); } });
    cityWin.wrapS = cityWin.wrapT = THREE.RepeatWrapping;
    [[-22, 10, 14, 24, 22], [FW + 22, 30, 16, 30, 16], [20, -18, 40, 12, 26], [40, FH + 26, 50, 12, 14]].forEach(([x, z, w, d, h]) => {
      const t = cityWin.clone(); t.needsUpdate = true; t.repeat.set(Math.max(w, d) / 8, h / 8);
      const m = add(new THREE.Mesh(B(w, h, d), new THREE.MeshStandardMaterial({ color: 0x30343c, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.8, map: t, roughness: 0.6 })));
      m.position.set(x, h / 2, z);
    });
    // 建物の外壁（外から見たとき用。中の壁の外側にもう一枚）
    const facade = MT.surface('concrete', 0xb8b4ac);
    [[FW / 2, -0.1, FW + 0.4, 0.2], [FW / 2, FH + 0.1, FW + 0.4, 0.2], [-0.1, FH / 2, 0.2, FH], [FW + 0.1, FH / 2, 0.2, FH]].forEach(([x, z, w, d]) => {
      const m = add(new THREE.Mesh(B(w, FLOOR_H + 4.2, d), facade)); m.position.set(x, (FLOOR_H + 4.2) / 2, z); m.castShadow = true; m.receiveShadow = true;
    });

    // ===================== 床 =====================
    // 通路は磨いたテラゾー（照明が映り込む）。店は種類ごとに木・タイル・カーペット
    const WOOD = ['カフェ', 'ベーカリー', '書店', 'レストラン', '靴', '雑貨', '楽器', 'インテリア', 'おもちゃ'];
    const CARPET = ['シネマ', 'ゲームセンター', 'アパレル', 'アクセサリー', 'メガネ'];
    const floorMats = {
      terrazzo: MT.surface('terrazzo'), wood: MT.surface('wood', 0xe0c8a8), carpet: MT.surface('fabric', 0xffffff, { uvScale: 1.5 }),
      tile: MT.surface('tile', 0xf4f4f0), concrete: MT.surface('concrete', 0xb0aca4),
    };
    const fl = { terrazzo: [], wood: [], carpet: [], tile: [], concrete: [] };
    list((t, x) => t !== T.WALL && t !== T.GAP && t !== T.VOID && !(x < OFF && (t === T.STAIR || t === T.PORTAL))).forEach((c) => {
      const st = storeAt(c.x, c.z);
      let k = 'terrazzo';
      if (c.z <= 2) k = 'concrete';
      else if (st) k = WOOD.includes(st.name) ? 'wood' : CARPET.includes(st.name) ? 'carpet' : 'tile';
      c.col = floorCol[idx(c.x, c.z)] || 0xd9d4ca;
      fl[k].push(c);
    });
    Object.keys(fl).forEach((k) => inst(group, B(1, 0.22, 1), floorMats[k], fl[k], (o, c) => {
      o.position.set(wxc(c.x), fy(c.x) - 0.11, c.z + 0.5);
      if (k === 'carpet') return new THREE.Color(c.col).lerp(new THREE.Color(0xffffff), 0.15).getHex();
      if (k === 'wood' || k === 'tile') return new THREE.Color(c.col).lerp(new THREE.Color(0xffffff), 0.55).getHex();
      if (k === 'terrazzo' && c.x >= OFF) return 0xe8e0d0;
      return undefined;
    }, 'receive'));

    // ===================== 壁 =====================
    // 店の正面：濃い色の枠と、映り込みのある暗いガラス（中は見えない＝ゲームの見通しと同じ）。上に看板の帯
    const walls = list((t) => t === T.WALL);
    const storefront = (x, z) => { const lx = map.wx(x); return z === 12 || z === 29 || ((lx === 14 || lx === 41) && z >= 17 && z <= 24); };
    const frontCells = walls.filter((c) => storefront(c.x, c.z));
    const plainCells = walls.filter((c) => !storefront(c.x, c.z));
    const wallH = (x) => (x >= OFF ? 4.0 : FLOOR_H - 0.22);
    const plaster = MT.surface('plaster', 0xf2eee6);
    inst(group, B(1, 1, 1), plaster, plainCells.filter((c) => c.z > 3), (o, c) => { const h = wallH(c.x); o.scale.set(1, h, 1); o.position.set(wxc(c.x), fy(c.x) + h / 2, c.z + 0.5); });
    inst(group, B(1, 1, 1), MT.surface('concrete', 0xa8a49c), plainCells.filter((c) => c.z <= 3), (o, c) => { const h = wallH(c.x); o.scale.set(1, h, 1); o.position.set(wxc(c.x), fy(c.x) + h / 2, c.z + 0.5); });
    // 店の正面：下の腰板・暗いガラス・上の看板帯
    const frontMetal = MT.plain(0x2a2e34, 0.35, 0.7);
    inst(group, B(1.01, 0.5, 1.01), frontMetal, frontCells, (o, c) => { o.position.set(wxc(c.x), fy(c.x) + 0.25, c.z + 0.5); });
    const shopGlow = cv(128, 256, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#fff2d8'); g.addColorStop(0.5, '#c89a6a'); g.addColorStop(1, '#5a4030');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,255,255,.45)'; x.fillRect(0, 10, w, 5);
    });
    inst(group, B(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.06, metalness: 0.5, envMapIntensity: 1.6, emissive: 0xffffff, emissiveMap: shopGlow, emissiveIntensity: 0.32 }), frontCells, (o, c) => { o.scale.set(1, 2.7, 1); o.position.set(wxc(c.x), fy(c.x) + 0.5 + 1.35, c.z + 0.5); });
    inst(group, B(1.02, 1, 1.02), MT.plain(0xe8e4dc, 0.6), frontCells, (o, c) => { const top = wallH(c.x) - 3.2; o.scale.set(1, top, 1); o.position.set(wxc(c.x), fy(c.x) + 3.2 + top / 2, c.z + 0.5); });
    // ガラスの縦の桟
    inst(group, B(0.05, 2.7, 1.04), frontMetal, frontCells.filter((c) => (c.x + c.z) % 2 === 0), (o, c) => {
      const lx = map.wx(c.x), vert = (lx === 14 || lx === 41) && c.z >= 17 && c.z <= 24;
      o.position.set(wxc(c.x) + (vert ? 0 : -0.5), fy(c.x) + 1.85, c.z + 0.5);
      if (!vert) o.rotation.y = 0; else { o.rotation.y = Math.PI / 2; o.position.set(wxc(c.x), fy(c.x) + 1.85, c.z); }
    });
    // 店の入口の上の枠
    const doorTops = list((t, x, z) => t === T.FLOOR && storefront(x, z) && get(x, z) !== T.WALL);
    inst(group, B(1, 0.6, 1), MT.plain(0x2a2e34, 0.35, 0.7, { camFade: true }), doorTops, (o, c) => { const h = wallH(c.x); o.position.set(wxc(c.x), fy(c.x) + h - 0.9, c.z + 0.5); });

    // 天井：1階の天井（2階の床の裏）と2階の天井。照明のパネル
    const ceilMat = MT.surface('ceil', 0xffffff);
    const under = list((t, x, z) => x < OFF && !(x >= 20 && x <= 35 && z >= 17 && z <= 24) && t !== T.GAP);
    inst(group, new THREE.PlaneGeometry(1, 1), ceilMat, under, (o, c) => { o.rotation.x = Math.PI / 2; o.position.set(c.x + 0.5, FLOOR_H - 0.23, c.z + 0.5); }, false);
    const ceil2 = add(new THREE.Mesh(new THREE.PlaneGeometry(FW, FH), ceilMat));
    ceil2.rotation.x = Math.PI / 2; ceil2.position.set(FW / 2, FLOOR_H + 4.0, FH / 2);
    // 吹き抜けの天窓（夕方の空）と、差し込む光
    const sky = add(new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.62, 0.95).multiplyScalar(1.6), toneMapped: false })));
    sky.rotation.x = Math.PI / 2; sky.position.set(28, FLOOR_H + 3.98, 21);
    inst(group, B(0.12, 0.12, 8), MT.plain(0x2a2e34, 0.4, 0.7), [20, 22, 24, 26, 28, 30, 32, 34, 36].map((x) => ({ x })), (o, c) => { o.position.set(c.x, FLOOR_H + 3.92, 21); }, false);
    const shaftMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { color: { value: new THREE.Color(0.55, 0.65, 0.95) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 color; varying vec2 vUv; void main(){ float a = smoothstep(0.0,0.2,vUv.x)*smoothstep(1.0,0.8,vUv.x)*pow(vUv.y,1.5)*0.16; gl_FragColor = vec4(color*a,1.0); }',
    });
    [[24, 19], [28, 22], [32, 19.5], [26, 21]].forEach(([x, z], i) => {
      const m = add(new THREE.Mesh(new THREE.PlaneGeometry(2.2, FLOOR_H + 4), shaftMat));
      m.position.set(x, (FLOOR_H + 4) / 2, z); m.rotation.y = i * 0.8; m.rotation.z = 0.08;
    });

    // 照明：天井の光る板。近くのものだけ本物の光になる（gfx の光源プール）
    const panels = [], off = [], sources = [];
    for (let fl2 = 0; fl2 < 2; fl2++) for (let z = 2; z < FH; z += 3) for (let x = 2; x < FW; x += 4) {
      const gx = x + fl2 * OFF;
      if (fl2 === 0 && x >= 20 && x <= 35 && z >= 17 && z <= 24) continue;
      if (fl2 === 1 && get(gx, z) === T.VOID) continue;
      if (get(gx, z) === T.WALL || get(gx, z) === T.GAP) continue;
      const y = fl2 ? FLOOR_H + 3.97 : FLOOR_H - 0.25;
      const st = storeAt(gx, z);
      const k = (x * 5 + z * 7 + fl2) % 9;
      const c = { x: gx, z, y };
      if (k === 0) { off.push(c); continue; }
      panels.push(c);
      sources.push({ x: wxc(gx), y: y - 0.2, z: z + 0.5, color: st ? 0xfff0dc : 0xf4f6ff, intensity: st ? 4 : 3.4, distance: 7.5 });
    }
    inst(group, B(1.6, 0.04, 0.5), MT.glow(0xfff6ea, 2.4), panels, (o, c) => { o.position.set(wxc(c.x), c.y, c.z + 0.5); }, false);
    inst(group, B(1.6, 0.04, 0.5), MT.plain(0x5a5e62, 0.4), off, (o, c) => { o.position.set(wxc(c.x), c.y, c.z + 0.5); }, false);
    // 赤い非常灯（出入口と吹き抜け）：ゆっくり点滅
    const beacons = [[1, 13], [54, 25.5], [40.5, 1], [27, 38], [20, 16.5], [35, 25]].map(([x, z]) => ({ x, z }));
    const beaconMat = MT.glow(0xff2a1a, 5).clone();
    inst(group, new THREE.SphereGeometry(0.11, 12, 8), beaconMat, beacons, (o, c) => { o.position.set(c.x + 0.5, 3.6, c.z + 0.5); }, false);
    const beaconSrc = beacons.map((c) => ({ x: c.x + 0.5, y: 3.3, z: c.z + 0.5, color: 0xff2a14, intensity: 5, distance: 9, flicker: () => 0.4 + 0.6 * Math.max(0, Math.sin(performance.now() * 0.004)) }));
    sources.push(...beaconSrc);

    // ===================== 階段・エスカレーター =====================
    const steps = list((t, x) => t === T.STAIR && x < OFF);
    const escal = (c) => c.z >= 17 && c.z <= 24;
    inst(group, B(1, 1, 1), MT.surface('brushed', 0x8a9096), steps.filter(escal), (o, c) => { const h = Math.max(0.05, stairY(c.x + 0.5, c.z + 0.5)); o.scale.set(1, h, 1); o.position.set(c.x + 0.5, h / 2, c.z + 0.5); });
    inst(group, B(1, 1, 1), MT.surface('concrete', 0xc0bcb2), steps.filter((c) => !escal(c)), (o, c) => { const h = Math.max(0.05, stairY(c.x + 0.5, c.z + 0.5)); o.scale.set(1, h, 1); o.position.set(c.x + 0.5, h / 2, c.z + 0.5); });
    // 踏み板の溝（エスカレーター）
    inst(group, B(0.96, 0.02, 0.04), MT.plain(0xd8c040, 0.5, 0.4), steps.filter(escal), (o, c) => { const h = stairY(c.x + 0.5, c.z + 0.5); o.position.set(c.x + 0.5, h + 0.01, c.z + 0.1); });
    // 側面：ガラスの手すりと黒い手すりベルト
    const rails = list((t, x) => t === T.RAIL && x < OFF);
    const glass = MT.glass(0xcfe4f0, 0.25);
    inst(group, B(0.06, 1, 1.02), glass, rails, (o, c) => { const h = Math.max(stairY(c.x + 1.5, c.z + 0.5), stairY(c.x - 0.5, c.z + 0.5)); o.scale.set(1, 1.0, 1); o.position.set(c.x + 0.5, h + 0.5, c.z + 0.5); }, false);
    inst(group, B(0.4, 1, 1.02), MT.plain(0xd8dcde, 0.35, 0.3), rails, (o, c) => { const h = Math.max(stairY(c.x + 1.5, c.z + 0.5), stairY(c.x - 0.5, c.z + 0.5)); o.scale.set(1, h + 0.05, 1); o.position.set(c.x + 0.5, (h + 0.05) / 2, c.z + 0.5); });
    inst(group, B(0.1, 0.06, 1.04), MT.plain(0x101010, 0.3), rails, (o, c) => { const h = Math.max(stairY(c.x + 1.5, c.z + 0.5), stairY(c.x - 0.5, c.z + 0.5)); o.position.set(c.x + 0.5, h + 1.02, c.z + 0.5); });
    // 2階の吹き抜けのガラスの手すり（ステンレスの笠木つき）
    const railEdges = [];
    list((t, x) => t === T.VOID && x >= OFF).forEach((c) => {
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz]) => {
        const n = get(c.x + dx, c.z + dz);
        if (n === T.FLOOR || n === T.LOW || n === T.EXIT || n === T.SHUT || n === T.BAR) railEdges.push({ x: c.x, z: c.z, dx, dz });
      });
    });
    const edgeGeo = (h, t) => B(1, h, t);
    const edgePlace = (y) => (o, c) => { o.position.set(wxc(c.x) + c.dx * 0.5, FLOOR_H + y, c.z + 0.5 + c.dz * 0.5); if (c.dx) o.rotation.y = Math.PI / 2; };
    inst(group, edgeGeo(1.0, 0.04), glass, railEdges, edgePlace(0.55), false);
    inst(group, edgeGeo(0.05, 0.08), MT.surface('brushed', 0xd0d4d8), railEdges, edgePlace(1.06));
    // 2階の床のへりの化粧板（吹き抜けから見上げたとき）
    inst(group, edgeGeo(0.4, 0.06), MT.plain(0xf2efe8, 0.5), railEdges, (o, c) => { o.position.set(wxc(c.x) + c.dx * 0.5, FLOOR_H - 0.2, c.z + 0.5 + c.dz * 0.5); if (c.dx) o.rotation.y = Math.PI / 2; });

    // ===================== 家具・商品 =====================
    const furn = list((t) => t === T.SHELF || t === T.LOW || t === T.LOCKER);
    const byDeco = {};
    furn.forEach((c) => { (byDeco[c.d] = byDeco[c.d] || []).push(c); });
    const at = (o, c, y) => { o.position.set(wxc(c.x), fy(c.x) + (y || 0), c.z + 0.5); };
    const shelfMat = MT.plain(0xd8dcdf, 0.45, 0.5);
    const occl = [shelfMat];
    const r01 = (n) => { const v = Math.sin(n * 91.7) * 43758.5; return v - Math.floor(v); };
    // 商品棚（ゴンドラ）：棚板と、並んだ商品（色とりどりの箱）
    const gond = byDeco[DECO.SHELF] || [];
    inst(group, merge([[B(0.9, 1.9, 0.12), [0, 0.95, 0]], [B(0.92, 0.04, 0.8), [0, 0.1, 0]], [B(0.92, 0.03, 0.7), [0, 0.6, 0]], [B(0.92, 0.03, 0.6), [0, 1.05, 0]], [B(0.92, 0.03, 0.5), [0, 1.5, 0]]]), shelfMat, gond, (o, c) => { at(o, c); });
    const goods = [];
    gond.forEach((c) => { [0.62, 1.07, 1.52, 0.12].forEach((y, r) => { for (let k = 0; k < 4; k++) for (const side of [-1, 1]) goods.push({ c, y: y + 0.02, x: -0.33 + k * 0.22, z: side * (0.16 + r01(c.x + k + r) * 0.08), h: 0.12 + r01(c.x * 3 + k + r * 7 + side) * 0.16, col: r01(c.z * 5 + k + r * 3 + side) }); }); });
    const PAL = [0xd84a3a, 0x3a7ad8, 0xf0c040, 0x48a868, 0xf2f2ea, 0xe07ab0, 0x8a5ad0, 0xf08a30];
    inst(group, B(0.18, 1, 0.14), MT.plain(0xffffff, 0.5), goods, (o, g) => { o.position.set(wxc(g.c.x) + g.x, fy(g.c.x) + g.y + g.h / 2, g.c.z + 0.5 + g.z); o.scale.set(1, g.h, 1); return PAL[Math.floor(g.col * PAL.length)]; });
    // 本棚
    const bookTex = cv(256, 256, (x, w) => { x.fillStyle = '#5a4630'; x.fillRect(0, 0, w, w); for (let r = 0; r < 4; r++) { let px = 6; while (px < w - 8) { const bw = 6 + Math.random() * 12; x.fillStyle = ['#2e4a7a', '#7a2e2e', '#2e6a4a', '#d8d2c0', '#c0902a', '#444', '#a05a8a'][Math.floor(Math.random() * 7)]; x.fillRect(px, r * 64 + 10 + Math.random() * 10, bw - 1.5, 48); px += bw; } x.fillStyle = '#3a2c1c'; x.fillRect(0, r * 64 + 58, w, 6); } });
    const bookMat = new THREE.MeshStandardMaterial({ map: bookTex, roughness: 0.7 });
    occl.push(bookMat);
    inst(group, B(0.9, 2.0, 0.9), bookMat, byDeco[DECO.BOOK] || [], (o, c) => at(o, c, 1.0));
    // テレビの売り場：棚に並んだ画面（光る）
    const tvs = byDeco[DECO.TV] || [];
    const tvMat = MT.plain(0x22262c, 0.4, 0.5);
    occl.push(tvMat);
    inst(group, B(0.9, 1.0, 0.7), tvMat, tvs, (o, c) => at(o, c, 0.5));
    inst(group, B(0.86, 0.5, 0.06), MT.plain(0x101216, 0.3), tvs, (o, c) => at(o, c, 1.35));
    const tvScreens = [];
    tvs.forEach((c) => tvScreens.push({ c, s: -1 }, { c, s: 1 }));
    inst(group, B(0.8, 0.44, 0.005), MT.glow(0x7ab8ff, 1.6), tvScreens.filter((q) => (q.c.x + q.c.z) % 3), (o, q) => { at(o, q.c, 1.35); o.position.z += q.s * 0.035; return [0x7ab8ff, 0xffb070, 0x90ffb0][q.c.x % 3]; }, false);
    // ゲームセンターの筐体：光る画面と看板
    const mach = byDeco[DECO.MACHINE] || [];
    const machMat = MT.plain(0x2a2440, 0.35, 0.3);
    occl.push(machMat);
    inst(group, merge([[B(0.85, 1.4, 0.75), [0, 0.7, 0]], [B(0.85, 0.35, 0.6), [0, 1.6, -0.08]]]), machMat, mach, (o, c) => { at(o, c); return [0x5a3a9a, 0x2a6a9a, 0x9a3a5a][(c.x + c.z) % 3]; });
    inst(group, B(0.62, 0.48, 0.02), MT.glow(0xffffff, 2.2), mach, (o, c) => { at(o, c, 1.15); o.position.z += c.z === 19 ? 0.38 : -0.38; o.rotation.x = c.z === 19 ? -0.25 : 0.25; return [0x7affd2, 0xff7ad8, 0xfff27a][(c.x + c.z) % 3]; }, false);
    inst(group, B(0.8, 0.22, 0.02), MT.glow(0xffffff, 3), mach, (o, c) => { at(o, c, 1.65); o.position.z += c.z === 19 ? 0.23 : -0.39; return [0xff5ab0, 0x5ad8ff, 0xffd040][(c.x + c.z + 1) % 3]; }, false);
    // 試着室
    inst(group, B(0.95, 2.1, 0.95), MT.surface('fabric', 0x9a3a4a), byDeco[DECO.BOOTH] || [], (o, c) => at(o, c, 1.05));
    // カフェ・レストラン・フードコートのテーブルと椅子
    const tables = byDeco[DECO.TABLE] || [];
    inst(group, merge([[CY(0.38, 0.38, 0.04, 20), [0, 0.74, 0]], [CY(0.03, 0.03, 0.72, 8), [0, 0.37, 0]], [CY(0.22, 0.22, 0.03, 16), [0, 0.015, 0]]]), MT.surface('deskwood', 0xd8b080), tables, (o, c) => at(o, c));
    const tchairs = [];
    tables.forEach((c) => { tchairs.push({ c, a: 0.3 + r01(c.x) }, { c, a: Math.PI + 0.3 + r01(c.z) }); });
    inst(group, merge([[B(0.38, 0.04, 0.38), [0, 0.45, 0]], [B(0.38, 0.4, 0.04), [0, 0.68, -0.18]], ...[[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]].map(([a, b]) => [CY(0.015, 0.015, 0.45, 6), [a, 0.225, b]])]), MT.plain(0x3a3e44, 0.4, 0.6), tchairs, (o, q) => { at(o, q.c); o.position.x += Math.sin(q.a) * 0.5; o.position.z += Math.cos(q.a) * 0.5; o.rotation.y = q.a + Math.PI; });
    // カウンター（レジ・ショーケース）
    const counters = byDeco[DECO.COUNTER] || [];
    inst(group, B(1, 0.95, 0.9), MT.surface('deskwood', 0x6e5a48), counters, (o, c) => at(o, c, 0.475));
    inst(group, B(1.02, 0.04, 0.92), MT.plain(0xe8e4dc, 0.2), counters, (o, c) => at(o, c, 0.97));
    inst(group, B(0.3, 0.22, 0.25), MT.plain(0x1a1c20, 0.3), counters.filter((c) => c.x % 3 === 0), (o, c) => at(o, c, 1.1));
    // ショーケース（ガラスと、中の光）
    const cases = byDeco[DECO.SHOWCASE] || [];
    inst(group, B(1, 0.6, 0.8), MT.plain(0xe8ecee, 0.3, 0.2), cases, (o, c) => at(o, c, 0.3));
    inst(group, B(0.96, 0.32, 0.76), MT.glass(0xeaf6ff, 0.3), cases, (o, c) => at(o, c, 0.77), false);
    inst(group, B(0.9, 0.02, 0.7), MT.glow(0xfff4e0, 1.6), cases, (o, c) => at(o, c, 0.62), false);
    // 映画館の座席・家具店のベッドとソファ・楽器店のピアノ
    inst(group, merge([[B(0.95, 0.12, 0.6), [0, 0.42, 0.05]], [B(0.95, 0.65, 0.12), [0, 0.6, -0.3]], [B(0.06, 0.6, 0.6), [-0.47, 0.3, 0]]]), MT.surface('fabric', 0x8a1f2c), byDeco[DECO.SEAT] || [], (o, c) => { at(o, c); o.rotation.y = Math.PI; });
    inst(group, B(1, 0.4, 1), MT.plain(0x6a5040, 0.5), byDeco[DECO.BED] || [], (o, c) => at(o, c, 0.2));
    inst(group, B(0.98, 0.18, 0.98), MT.surface('fabric', 0xf4f0e8), byDeco[DECO.BED] || [], (o, c) => at(o, c, 0.48));
    inst(group, merge([[B(1, 0.4, 0.9), [0, 0.2, 0]], [B(1, 0.45, 0.2), [0, 0.6, -0.35]]]), MT.surface('fabric', 0x7a5a44), byDeco[DECO.SOFA] || [], (o, c) => at(o, c));
    inst(group, merge([[B(1, 1.1, 0.55), [0, 0.55, -0.2]], [B(1, 0.06, 0.3), [0, 0.75, 0.15]]]), MT.plain(0x0c0c0e, 0.1, 0.1), byDeco[DECO.PIANO] || [], (o, c) => at(o, c));
    // 服のラック：銀のバーに、色とりどりの服
    const racks = byDeco[DECO.RACK] || [];
    inst(group, merge([[CY(0.015, 0.015, 1, 6), [0, 1.3, 0], [0, 0, Math.PI / 2]], [CY(0.015, 0.015, 1.3, 6), [-0.48, 0.65, 0]], [CY(0.015, 0.015, 1.3, 6), [0.48, 0.65, 0]]]), MT.surface('brushed'), racks, (o, c) => at(o, c));
    const clothes = [];
    racks.forEach((c) => { for (let k = 0; k < 7; k++) clothes.push({ c, k }); });
    inst(group, B(0.05, 0.75, 0.42), MT.surface('fabric', 0xffffff), clothes, (o, q) => { at(o, q.c, 0.9); o.position.x += -0.4 + q.k * 0.13; o.rotation.y = (r01(q.k + q.c.x) - 0.5) * 0.3; return [0xd8c8b0, 0x2a3a5a, 0xb85a4a, 0xe8e4dc, 0x5a7a5a, 0xc8a0b8, 0x3a3a3a][(q.k + q.c.x) % 7]; });
    // 植え込み：鉢と葉のかたまり
    const plants = byDeco[DECO.PLANTER] || [];
    inst(group, B(1, 0.6, 1), MT.surface('concrete', 0x8a8478), plants, (o, c) => at(o, c, 0.3));
    const leafGeo = new THREE.IcosahedronGeometry(0.42, 1);
    inst(group, leafGeo, MT.surface('grass', 0x8ab070), plants, (o, c) => { at(o, c, 0.95); o.scale.set(1, 0.85, 1); o.rotation.y = c.x; });
    // 噴水：石の縁と、光る水面
    const fount = byDeco[DECO.FOUNTAIN] || [];
    if (fount.length) {
      const rim = add(new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.18, 12, 40), MT.surface('terrazzo', 0xc8c0b4)));
      rim.rotation.x = Math.PI / 2; rim.position.set(28, 0.45, 21); rim.castShadow = true;
      const basin = add(new THREE.Mesh(CY(1.8, 1.9, 0.45, 40), MT.surface('terrazzo', 0xb8b0a4)));
      basin.position.set(28, 0.22, 21);
      const water = add(new THREE.Mesh(CY(1.62, 1.62, 0.04, 40), new THREE.MeshStandardMaterial({ color: 0x2a6a8a, roughness: 0.02, metalness: 0.2, envMapIntensity: 2, emissive: 0x0a3a5a })));
      water.position.set(28, 0.5, 21);
      const spout = add(new THREE.Mesh(CY(0.12, 0.2, 1.1, 16), MT.surface('terrazzo', 0xd8d0c4)));
      spout.position.set(28, 0.9, 21);
    }
    // フロアガイド（光る案内板）
    const guide = document.createElement('canvas');
    guide.width = 512; guide.height = 640;
    const g = guide.getContext('2d');
    g.fillStyle = '#1d2733'; g.fillRect(0, 0, 512, 640);
    g.fillStyle = '#ffd34d'; g.font = '900 40px ' + FONT; g.fillText('FLOOR GUIDE', 24, 60);
    [1, 0].forEach((f, i) => {
      const names = STORES.filter((s) => s.fl === f).map((s) => s.name);
      g.fillStyle = '#7fe3ff'; g.font = '900 36px ' + FONT; g.fillText(f ? '2F' : '1F', 24, 130 + i * 250);
      g.fillStyle = '#f2efe6'; g.font = '700 26px ' + FONT;
      names.forEach((n, j) => g.fillText(n, 90 + (j % 2) * 210, 130 + i * 250 + Math.floor(j / 2) * 38));
    });
    const guideTex = new THREE.CanvasTexture(guide); guideTex.colorSpace = THREE.SRGBColorSpace;
    const boards = byDeco[DECO.BOARD] || [];
    inst(group, B(0.9, 1.9, 0.18), MT.plain(0x2a2e34, 0.35, 0.6), boards, (o, c) => at(o, c, 0.95));
    const guideMat = new THREE.MeshBasicMaterial({ map: guideTex, color: new THREE.Color(1.3, 1.3, 1.3), toneMapped: false });
    boards.forEach((c) => [1, -1].forEach((s) => { const m = add(new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), guideMat)); m.position.set(wxc(c.x), fy(c.x) + 1.35, c.z + 0.5 + s * 0.095); if (s < 0) m.rotation.y = Math.PI; }));
    // ロッカー（靴屋の倉庫）
    const lockerMat = MT.surface('locker', 0x9ab0c0).clone();
    MT.worldUV(lockerMat, 0.5);
    occl.push(lockerMat);
    inst(group, B(0.86, 2.0, 0.92), lockerMat, byDeco[DECO.NONE] || [], (o, c) => at(o, c, 1.0));
    // シネマのスクリーン
    const screen = add(new THREE.Mesh(new THREE.PlaneGeometry(10, 2.6), MT.glow(0xbfd0ff, 1.4)));
    screen.position.set(48, FLOOR_H + 2.2, 4.03);

    // ===================== 看板・表示 =====================
    // 店の看板：内側から光る箱（文字が光ってにじむ）
    const SIGNC = { カフェ: '#6a3a1a', ベーカリー: '#8a4a1a', スーパー: '#1a6a3a', ドラッグストア: '#1a4a8a', シネマ: '#4a1a5a', ゲームセンター: '#2a1a6a', フードコート: '#8a3a1a', アパレル: '#1a1a1a', 書店: '#2a4a2a' };
    STORES.forEach((st) => {
      const tx = cv(512, 128, (x, w, h) => {
        x.fillStyle = SIGNC[st.name] || '#1f2a36'; x.fillRect(0, 0, w, h);
        x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0, 0, w, h * 0.45);
        x.fillStyle = '#fff6e8'; x.font = '900 ' + (st.name.length > 5 ? 56 : 70) + 'px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(st.name, w / 2, h / 2 + 4);
      });
      const m = add(new THREE.Mesh(B(2.6, 0.62, 0.12), [MT.plain(0x2a2e34, 0.4, 0.6), MT.plain(0x2a2e34, 0.4, 0.6), MT.plain(0x2a2e34, 0.4, 0.6), MT.plain(0x2a2e34, 0.4, 0.6), new THREE.MeshBasicMaterial({ map: tx, color: new THREE.Color(1.5, 1.5, 1.5), toneMapped: false }), new THREE.MeshBasicMaterial({ map: tx, color: new THREE.Color(1.5, 1.5, 1.5), toneMapped: false })]));
      const [sx, sz] = st.sign;
      const y = (st.fl ? FLOOR_H : 0) + (st.fl ? 3.45 : 3.65);
      const vert = Math.abs(sx - 14.6) < 0.3 || Math.abs(sx - 40.4) < 0.3;
      m.position.set(sx + 0.5, y, sz);
      if (vert) m.rotation.y = Math.PI / 2;
    });
    // 出入口の非常口の表示
    const exitTex = cv(256, 128, (x, w, h) => { x.fillStyle = '#0f9d58'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = '900 46px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('非常口', w / 2, h / 2); });
    const exitMat = new THREE.MeshBasicMaterial({ map: exitTex, color: new THREE.Color(1.8, 1.8, 1.8), toneMapped: false, side: THREE.DoubleSide });
    [[0.6, 14.9, Math.PI / 2], [55.4, 27, -Math.PI / 2], [41, 0.7, 0], [28, 38.6, Math.PI]].forEach(([x, z, r]) => { const m = add(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), exitMat)); m.position.set(x, 2.9, z); m.rotation.y = r; });
    // 吹き抜けに下がるセールの垂れ幕
    const banner = cv(128, 512, (x, w, h) => { x.fillStyle = '#c8202c'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = '900 70px ' + FONT; x.textAlign = 'center'; ['秋', 'の', '大', '感', '謝', '祭'].forEach((t, i) => x.fillText(t, w / 2, 70 + i * 76)); });
    const bannerMat = new THREE.MeshStandardMaterial({ map: banner, side: THREE.DoubleSide, roughness: 0.8 });
    [[23.5, 18], [32.5, 23.5]].forEach(([x, z]) => { const m = add(new THREE.Mesh(new THREE.PlaneGeometry(1.1, 4.2), bannerMat)); m.position.set(x, FLOOR_H + 1.9, z); });

    TG.gfx.setLightSources(sources);
    function update(t) {
      beaconMat.color.setScalar(0.5 + 4.5 * Math.max(0, Math.sin(t * 4)));
      beaconMat.color.g = 0.1 * beaconMat.color.r; beaconMat.color.b = 0.05 * beaconMat.color.r;
    }
    return { policeLights: lights, occluders: occl, onExit: () => {}, update, lightSources: sources };
  }

  // ======================= 封鎖（シャッター・バリケード） =======================
  // 毎回ちがう場所が閉まる。閉まったマスは SHUT（店・出口・非常階段のシャッター：通れず、向こうも見えない）か
  // BAR（通路のバリケード・止まったエスカレーター：通れないが、しゃがまなければ向こうから見える）になる。
  // 選んだ組み合わせで「スタート→彼女→出口」がつながっているか、敵の見回りが詰まないか、
  // 無駄な大回りになっていないかを確かめてから使う。彼女を助けると、さらに一番近い出口と通路が1つ閉まる。
  const BASE = grid.slice();
  const cellsX = (x0, x1, z, fl) => { const o = []; for (let x = x0; x <= x1; x++) o.push([x + (fl || 0) * OFF, z]); return o; };
  const cellsZ = (x, z0, z1, fl) => { const o = []; for (let z = z0; z <= z1; z++) o.push([x + (fl || 0) * OFF, z]); return o; };
  const axisOf = (cells) => (cells[0][1] === cells[1][1] ? 'x' : 'z');
  const both = (fn) => fn(0).concat(fn(1));
  const CL = {
    exits: [cellsZ(0, 14, 15), cellsZ(55, 26, 27), cellsX(40, 41, 0), cellsX(26, 29, 39)]
      .map((cells, i) => ({ kind: 'shut', exit: i, sign: '閉鎖', cells })),
    // 上下の階のつなぎ：エスカレーター2基（止まる）、非常階段2つ（シャッター）
    links: [
      { kind: 'bar', sign: '停止中', name: '西のエスカレーター', cells: cellsX(22, 23, 24, 0).concat(cellsX(22, 23, 17, 1)) },
      { kind: 'bar', sign: '停止中', name: '東のエスカレーター', cells: cellsX(32, 33, 17, 0).concat(cellsX(32, 33, 24, 1)) },
      { kind: 'shut', sign: '閉鎖', name: '西の非常階段', cells: cellsZ(10, 1, 2, 0).concat(cellsZ(3, 1, 2, 1)) },
      { kind: 'shut', sign: '閉鎖', name: '東の非常階段', cells: cellsZ(45, 1, 2, 0).concat(cellsZ(52, 1, 2, 1)) },
    ],
    // 通路のバリケード：北と南の通路、バックヤード、2階の吹き抜けの両脇の渡り廊下
    cuts: both((fl) => [cellsZ(10, 13, 16, fl), cellsZ(29, 13, 16, fl), cellsZ(45, 13, 16, fl), cellsZ(17, 25, 28, fl), cellsZ(38, 25, 28, fl), cellsZ(30, 1, 2, fl)])
      .concat([cellsX(15, 19, 20, 1), cellsX(36, 40, 20, 1)])
      .map((cells) => ({ kind: 'bar', sign: '立入禁止', cells })),
    // 店のシャッター：北の店は表と裏（バックヤード）の2か所に入口があるので、抜け道になる
    shops: both((fl) => [
      cellsX(6, 8, 12, fl), cellsX(19, 21, 12, fl), cellsX(33, 35, 12, fl), cellsX(47, 49, 12, fl),
      cellsX(11, 12, 3, fl), cellsX(20, 21, 3, fl), cellsX(34, 35, 3, fl), cellsX(42, 43, 3, fl),
      cellsZ(14, 20, 21, fl), cellsZ(41, 20, 21, fl), cellsX(6, 8, 29, fl), cellsX(34, 36, 29, fl), cellsX(47, 49, 29, fl),
    ]).concat([cellsX(19, 21, 29, 1)]).map((cells) => ({ kind: 'shut', cells })),
  };
  const closeCells = (c) => { for (const [x, z] of c.cells) grid[idx(x, z)] = c.kind === 'shut' ? T.SHUT : T.BAR; };
  const pickN = (list, n, not) => {
    const pool = list.filter((c) => !(not && not.includes(c)));
    const out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return out;
  };
  const START = { x: 23.5, z: 36.5 };
  // 通路のバリケードの場所を言葉にする（「2階の北側の通路の東寄り」など）
  function cutName(c) {
    const [x, z] = c.cells[0], fl = x >= OFF ? '2階' : '1階', lx = x % OFF;
    if (z <= 2) return fl + 'のバックヤード';
    if (z === 20) return fl + 'の吹き抜けの' + (lx < 30 ? '西' : '東') + '側の渡り廊下';
    return fl + 'の' + (z < 20 ? '北' : '南') + '側の通路の' + (lx < 20 ? '西寄り' : lx < 40 ? '真ん中' : '東寄り');
  }

  function makePlan(ctx, stage, spot, diff) {
    const len = (a, b) => { const q = ctx.findPath(a.x, a.z, b.x, b.z); return q ? q.length : 1e9; };
    const exits = stage.exits;
    const routes = stage.lists[diff].map((id) => (id === 'hold' ? spot.guard : stage.enemies[id].route));
    const routesOk = (seen) => routes.every((r) => r.every((w) => ctx.reached(seen, w[0] + 0.5, w[1] + 0.5)));
    const shutAt = (i) => grid[i] === T.SHUT || grid[i] === T.BAR;
    grid.set(BASE);
    const base1 = len(START, spot.pos);
    const baseEsc = exits.map((ex) => len(spot.pos, ex));
    for (let tries = 0; tries < 80; tries++) {
      grid.set(BASE);
      const A = [].concat(pickN(CL.exits, 1), pickN(CL.links, 1), pickN(CL.cuts, 3), pickN(CL.shops, 3));
      A.forEach(closeCells);
      const seen = ctx.reachFrom(START.x, START.z);
      const open = exits.map((ex, i) => i).filter((i) => !A.some((c) => c.exit === i));
      if (![spot.pos, spot.charm, stage.leave.pos].every((p) => ctx.reached(seen, p.x, p.z))) continue;
      if (!open.every((i) => ctx.reached(seen, exits[i].x, exits[i].z)) || !routesOk(seen)) continue;
      if (len(START, spot.pos) > base1 * 1.6 + 8) continue;
      // 助けたあと：彼女の居場所から一番近い出口と、通路が1つ閉まる
      const near = open.map((i) => [i, len(spot.pos, exits[i])]).sort((a, b) => a[1] - b[1])[0][0];
      const B = [CL.exits[near]].concat(pickN(CL.cuts, 1, A));
      B.forEach(closeCells);
      const seenB = ctx.reachFrom(spot.pos.x, spot.pos.z);
      const rest = open.filter((i) => i !== near);
      let nA = 0, nB = 0;
      for (let i = 0; i < seen.length; i++) { if (seen[i] && !shutAt(i)) nA++; if (seenB[i]) nB++; }
      const esc = Math.min(...rest.map((i) => len(spot.pos, exits[i])));
      // 閉まったせいで誰かが閉じ込められる形（行き止まりの区画）は使わない
      const okB = nB >= nA && rest.every((i) => ctx.reached(seenB, exits[i].x, exits[i].z)) && routesOk(seenB) && esc <= Math.min(...rest.map((i) => baseEsc[i])) * 1.6 + 10;
      grid.set(BASE);
      A.forEach(closeCells);
      if (okB) return { A, B };
    }
    grid.set(BASE);
    return { A: [], B: [] };
  }

  // 見た目：シャッターは灰色の波板、バリケードは黄色と黒の柵。看板つき
  let CMAT = null;
  function closureMats() {
    if (CMAT) return CMAT;
    const tex = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 64; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
    const shutTex = tex((g) => { g.fillStyle = '#9aa1a8'; g.fillRect(0, 0, 64, 64); for (let y = 0; y < 64; y += 8) { g.fillStyle = '#7d848c'; g.fillRect(0, y, 64, 3); g.fillStyle = '#b9c0c6'; g.fillRect(0, y + 3, 64, 1); } });
    shutTex.repeat.set(1, 4);
    const barTex = tex((g) => { g.fillStyle = '#ffcc1a'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#1b1b1b'; for (let x = -64; x < 64; x += 24) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 12, 64); g.lineTo(x + 76, 0); g.lineTo(x + 64, 0); g.closePath(); g.fill(); } });
    barTex.repeat.set(1, 1);
    CMAT = {
      shut: new THREE.MeshStandardMaterial({ map: shutTex, roughness: 0.45, metalness: 0.7 }),
      bar: new THREE.MeshStandardMaterial({ map: barTex, roughness: 0.5 }),
      post: new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.6 }),
    };
    return CMAT;
  }
  function signSprite(text, bg) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 72;
    const x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(4, 4, 248, 64);
    x.strokeStyle = '#ffffff'; x.lineWidth = 4; x.strokeRect(8, 8, 240, 56);
    x.fillStyle = '#ffffff'; x.font = '900 38px "Zen Kaku Gothic New", sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 38);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
    s.scale.set(1.5, 0.42, 1);
    return s;
  }
  function closureVis(dyn, c, hidden) {
    const M3 = closureMats();
    const holders = [];
    const axis = axisOf(c.cells);
    c.cells.forEach(([cx, cz]) => {
      const x = map.wx(cx) + 0.5, z = cz + 0.5, y = map.wy(cx + 0.5, cz + 0.5);
      const h = new THREE.Group();
      if (axis === 'z') h.rotation.y = Math.PI / 2;
      if (c.kind === 'shut') {
        const H = cx >= OFF ? 3.95 : 4.25 - (y > 0.1 ? 0.3 : 0);
        const m = new THREE.Mesh(new THREE.BoxGeometry(1.0, H, 0.16), M3.shut);
        m.position.y = -H / 2;
        h.add(m);
        h.position.set(x, y + H, z); // 上から下りてくる
      } else {
        [-0.42, 0.42].forEach((px) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.15, 0.08), M3.post); p.position.set(px, 0.575, 0); h.add(p); });
        [0.5, 0.95].forEach((py) => { const r = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 0.06), M3.bar); r.position.set(0, py, 0); h.add(r); });
        h.position.set(x, y, z);
      }
      if (hidden) h.scale.y = 0.001;
      dyn.add(h);
      holders.push(h);
    });
    let sign = null;
    if (c.sign) {
      const mid = c.cells[Math.floor((c.cells.length - 1) / 2)];
      // 階をまたぐもの（エスカレーター・階段）は、それぞれの階に看板を出す
      const ends = [mid].concat(c.cells.filter((q) => (q[0] >= OFF) !== (mid[0] >= OFF)).slice(0, 1));
      sign = ends.map(([cx, cz]) => {
        const s = signSprite(c.sign, c.kind === 'shut' ? '#c0392b' : '#d35400');
        const even = ends.length === 1 && c.cells.length % 2 === 0;
        s.position.set(map.wx(cx) + (even && axis === 'x' ? 1 : 0.5), map.wy(cx + 0.5, cz + 0.5) + (c.kind === 'shut' ? 2.7 : 1.6), cz + (even && axis === 'z' ? 1 : 0.5));
        s.visible = !hidden;
        dyn.add(s);
        return s;
      });
    }
    return { holders, sign };
  }

  // ======================= ステージ設定 =======================
  const D = Math.PI / 180;
  const S = 0, N = 180 * D, E = 90 * D, Wd = -90 * D;
  const F2 = (x) => x + OFF;

  const ENEMIES = {
    ent1: { room: 'hall', route: [[27, 34, 5, N, E, Wd]] },
    ent2: { route: [[27, 31, 2, N], [28, 27, 3, Wd, E]] },
    n_con: { route: [[3, 14, 2, E], [52, 14, 2, Wd]] },
    s_con: { route: [[3, 27, 2, E], [52, 27, 2, Wd]] },
    atr: { route: [[17, 20, 3, E], [27, 18, 3, S, E, Wd], [38, 20, 3, Wd]] },
    svc1: { route: [[12, 1, 3, E], [44, 2, 3, Wd]] },
    wexit: { route: [[2, 15, 4, E, S, N]] },
    eexit: { route: [[53, 26, 4, Wd, N, S]] },
    staffg: { route: [[39, 2, 4, E, Wd]] },
    super: { room: 'super0', route: [[43, 5, 3, S], [53, 10, 3, Wd]] },
    // エスカレーターで1階と2階を行き来する見回り
    esc: { route: [[22, 26, 2, N], [F2(22), 15, 2, E], [F2(32), 26, 2, N], [32, 15, 2, S]] },
    n2: { route: [[F2(3), 14, 2, E], [F2(52), 14, 2, Wd]] },
    s2: { route: [[F2(3), 27, 2, E], [F2(52), 27, 2, Wd]] },
    bal: { route: [[F2(17), 20, 2, E], [F2(38), 20, 2, Wd]] },
    svc2: { route: [[F2(12), 1, 3, E], [F2(44), 2, 3, Wd]] },
    books: { room: 'books1', route: [[F2(4), 10, 3, N], [F2(10), 10, 3, N]] },
    boss: { room: 'lounge', boss: true, route: [[F2(28), 31, 6, S, E, Wd, N]] },
  };

  // 人質になった買い物客（座らされている）
  const hostages = [
    [43, 6], [43, 7], [45, 10], [47, 10], [49, 10], [2, 31], [2, 32], [4, 31],
    [F2(32), 37], [F2(33), 37], [F2(34), 37], [F2(35), 37],
  ].map(([x, z], i) => ({ x: x + 0.5, z: z + 0.5, face: (i * 1.7) % (Math.PI * 2), i }));

  const HERO = 'カズヤ', GIRL = '美咲';
  // 話を聞ける人の立ち絵と3Dモデル
  const WOMAN = { cast: 'mall_woman', faces: ['worried', 'serious', 'serious'] };
  const MAN = { cast: 'mall_man', faces: ['panic', 'serious', 'serious'] };
  const CLERK = { cast: 'clerk', faces: ['worried', 'serious', 'serious'], model: () => TG.models.human({ kind: 'adultF', top: 0x2f6b5a, skirt: 0x2a2a2e, pants: 0x2a2a2e, shoes: 0x1c1a18, hair: 0x2a1c14, hairStyle: 'pony', skin: 0xeec4a4, brow: 'worried', mouth: 'frown' }) };

  TG.STAGES.mall = {
    id: 'mall',
    order: 2,
    title: 'ショッピングモールにテロリスト',
    place: '舞台：2階建てのショッピングモール',
    desc: '日曜日のデート中、モールが占拠された。毎回ちがう場所が封鎖される館内で、店や2つのフロアを抜けるルートを見つけて彼女を探し出し、2人で脱出しろ。',
    goal: 'ゴール：美咲と出入口のどれかから脱出',
    map,
    buildWorld: build,
    // 遊ぶたびに封鎖する場所を決める（敵を置く前）
    prepare(ctx, spot, diff) {
      const plan = makePlan(ctx, this, spot, diff);
      const G = ctx.G;
      plan.A.forEach((c) => {
        closeCells(c);
        closureVis(ctx.dyn, c, false);
        if (c.exit !== undefined) G.closedExits.add(c.exit);
      });
      G.closure = { closed: plan.A, armed: false, delay: 0, pending: plan.B.map((c) => ({ c, vis: closureVis(ctx.dyn, c, true), t: -1 })) };
    },
    // 彼女を助けると、追っ手が出口と通路をふさぎにかかる
    onRescue(ctx) {
      const C = ctx.G.closure;
      if (!C || !C.pending.length) return;
      C.armed = true;
      C.delay = 1.2;
      ctx.say('館内放送', '「人質が逃げたぞ！ 防火シャッターを下ろせ！」', 5);
    },
    tick(ctx, dt) {
      const C = ctx.G.closure;
      if (!C || !C.armed) return;
      if (C.delay > 0) { C.delay -= dt; return; }
      const G = ctx.G, P = ctx.P;
      const who = [P].concat(G.followers, G.enemies);
      for (const p of C.pending) {
        if (p.t < 0) {
          // 誰かが真下にいるあいだは閉めない（閉じ込めたり、はさんだりしない）
          if (p.c.cells.some(([x, z]) => who.some((o) => Math.abs(o.x - (x + 0.5)) < 1.0 && Math.abs(o.z - (z + 0.5)) < 1.0))) continue;
          closeCells(p.c);
          if (p.c.exit !== undefined) G.closedExits.add(p.c.exit);
          if (p.vis.sign) p.vis.sign.forEach((s) => { s.visible = true; });
          p.t = 0;
          ctx.sfx.door();
          ctx.mapChanged();
        } else if (p.t < 1) {
          p.t = Math.min(1, p.t + dt / 1.2);
          p.vis.holders.forEach((h) => { h.scale.y = Math.max(0.001, p.t); });
        }
      }
    },
    sky: 0x9fb4c4,
    // 見た目：日曜の夕方。館内の照明は生きているが、非常灯の赤がところどころに灯る
    look: {
      sky: [0x101a33, 0x50607a, 0x161414], sunGlow: 0x000000, sunDir: [0.22, 1, 0.16],
      fog: [0x1c2028, 0.018],
      hemi: [0xe6ecff, 0x4a4036, 0.85],
      rim: 0x405a80,
      sun: [0xf2f0ff, 2.0],
      env: { base: 0x2a2e36, floor: 0x3a342c, panels: [[0, 9.8, 0, 6, 0.2, 26, 0xffffff, 3], [-8, 9.8, 0, 2, 0.2, 26, 0xfff2dc, 2.2], [8, 9.8, 0, 2, 0.2, 26, 0xfff2dc, 2.2], [14.8, 2, 0, 0.2, 2, 6, 0xff2a20, 1.2]] },
      exposure: 0.95, bloom: 0.65, bloomThr: 1.1, vignette: 0.5, sat: 1.0,
      lift: [0.01, 0.015, 0.035], gain: [1.0, 1.0, 1.03], tint: [1, 1, 1],
    },
    par: 540,
    titleCam: { x: 28, z: 20, r: 44, h: 30 },
    camTop: (x) => (x >= OFF - 2 ? 3.5 : 3.9),
    enemies: ENEMIES,
    lists: {
      easy: ['hold', 'ent1', 'n_con', 'esc', 'n2', 's2'],
      normal: ['hold', 'ent1', 'ent2', 'n_con', 's_con', 'atr', 'wexit', 'esc', 'n2', 's2'],
      hard: ['hold', 'ent1', 'ent2', 'n_con', 's_con', 'atr', 'svc1', 'wexit', 'eexit', 'staffg', 'super', 'esc', 'n2', 's2', 'bal', 'svc2', 'boss'],
    },
    start: { locker: { x: 24, z: 36 } },
    startRoom: 'shoes0',
    leave: { text: '靴屋から出ろ', pos: { x: 20.5, z: 28.6 }, label: '店の出口' },
    key: null,
    exits: [
      { x: 0.6, z: 15, label: '西の非常口' },
      { x: 55.4, z: 27, label: '東の非常口' },
      { x: 41, z: 0.6, label: '搬入口' },
      { x: 28, z: 39.4, label: '正面入口' },
    ],
    exitText: GIRL + 'と出口へ',
    hostages,
    // 美咲の居場所の候補。riddle は美咲から届くメッセージ、hint は目的の欄、
    // charm は近くの通路に落ちている美咲のショッピングバッグ（拾うと居場所が分かる）
    girlSpots: [
      { id: 'cafe', room: 'cafe0', pos: C(25, 5), face: -Math.PI / 2, hint: 'コーヒーの香りがする店？', riddle: 'つかまっちゃった……コーヒーのいい匂いがする',
        charm: C(20, 14), guard: [[22, 6, 4, E, S], [20, 10, 3, N, E]],
        talk: { short: '1階の北側の店', line: '「1階の北側のお店のほうに、若い女の人が連れていかれるのを見たわ」', rect: { x0: 0, z0: 3, x1: 55, z1: 12 } } },
      { id: 'cinema', room: 'cinema1', pos: C(51, 4, 1), face: 0, hint: '大きなスクリーンのある暗い所？', riddle: '暗い……大きなスクリーンが見える',
        charm: C(47, 14, 1), guard: [[F2(48), 4, 4, E, Wd], [F2(48), 10, 3, N]],
        talk: { short: '2階の北側', line: '「2階の北側……奥のほうへ歩かされてた。暗い所だったわ」', rect: { x0: 60, z0: 3, x1: 115, z1: 12 } } },
      { id: 'apparel', room: 'apparel0', pos: C(1, 20), face: Math.PI / 2, hint: '試着室のある店？', riddle: 'カーテンと鏡がいっぱいのところにいる',
        charm: C(16, 22), guard: [[6, 20, 4, Wd, E], [11, 21, 3, Wd]],
        talk: { short: '1階の西寄り', line: '「1階の西のほうのお店に入っていくのを見ました」', rect: { x0: 0, z0: 0, x1: 19, z1: 39 } } },
      { id: 'arcade', room: 'arcade1', pos: C(53, 20, 1), face: -Math.PI / 2, hint: 'ゲームの音がうるさい店？', riddle: 'ゲームの音がうるさくて、何も聞こえない',
        charm: C(37, 22, 1), guard: [[F2(46), 20, 3, E, Wd], [F2(50), 21, 3, E]],
        talk: { short: '2階の東寄り', line: '「2階の東のほう……にぎやかなお店のあたりに連れていかれたわ」', rect: { x0: 96, z0: 0, x1: 115, z1: 39 } } },
      { id: 'food', room: 'food1', pos: C(52, 37, 1), face: Math.PI, hint: 'いろんな料理の匂いがする所？', riddle: 'いろんな料理の匂いがする、広いところ……',
        charm: C(47, 27, 1), guard: [[F2(46), 34, 3, E, S], [F2(50), 31, 3, S]],
        talk: { short: '2階の南側', line: '「2階の南側の、広いところに連れていかれたみたい」', rect: { x0: 60, z0: 25, x1: 115, z1: 39 } } },
    ],
    // 会話に出る人物（立ち絵を先に読み込む）。美咲は救出対象
    cast: ['misaki', 'mall_woman', 'mall_man', 'clerk', 'terrorist', 'leader', 'police'],
    heroine: 'misaki',
    // 目的の欄は、美咲のメッセージの手がかりに、聞いた話を足していく
    keepSpotHint: true,
    // 話を聞ける人：女性客は美咲を見かけた場所、男性客と店員は封鎖の様子（どの道が使えないか）を教えてくれる
    informants: {
      spots: [
        { i: 201, name: '買い物客の女性', ...C(4, 37), face: N, room: 'drug0', ...WOMAN },
        { i: 203, name: '買い物客の女性', ...C(2, 10, 1), face: E, room: 'books1', ...WOMAN },
        { i: 205, name: '買い物客の女性', ...C(16, 37, 1), face: N, room: 'glasses1', ...WOMAN },
        { i: 207, name: '買い物客の女性', ...C(32, 38), face: N, room: 'flower0', ...WOMAN },
        { i: 202, name: '買い物客の男性', ...C(43, 20), face: E, room: 'electro0', ...MAN },
        { i: 204, name: '買い物客の男性', ...C(12, 23, 1), face: N, room: 'interior1', ...MAN },
        { i: 206, name: '買い物客の男性', ...C(13, 10), face: Wd, room: 'sport0', ...MAN },
        { name: '店員', ...C(48, 31), face: S, room: 'bakery0', ...CLERK },
        { name: '店員', ...C(20, 10, 1), face: S, room: 'toys1', ...CLERK },
      ],
      // 3人（女性客・男性客・店員）を1人ずつ、行ける場所からランダムに
      pick: (pool, shuffle) => ['mall_woman', 'mall_man', 'clerk'].map((k) => shuffle(pool.filter((c) => c.cast === k))[0]).filter(Boolean),
      hintFor(spot, c, G) {
        const closed = (G.closure && G.closure.closed) || [];
        const st = TG.STAGES.mall;
        if (c.cast === 'mall_woman') return spot.talk;
        if (c.cast === 'mall_man') {
          const ex = closed.find((q) => q.exit !== undefined);
          const where = ex ? st.exits[ex.exit].label + 'はシャッターで閉められてた。あそこからは出られない。' : '出口はまだ全部は閉められてないみたいだ。';
          return { route: true, short: '', rect: null, line: '「' + where + 'それと……あいつら、人質が逃げたら近くの出口も閉めるって無線で話してたぞ」' };
        }
        const link = closed.find((q) => q.name);
        const cut = closed.find((q) => q.sign === '立入禁止');
        const a = link ? link.name + 'は止められてます。上と下を行き来するなら、別の道を使ってください。' : '';
        const b = cut ? cutName(cut) + 'も、バリケードでふさがれてました' : '';
        return { route: true, short: '', rect: null, line: '「' + (a + b || '今のところ、通れない所は見ていません') + '」' };
      },
    },
    rescueTalk: [
      { who: 'misaki', face: 'surprised', t: HERO + '……！？ 本当に、' + HERO + 'なの……？' },
      { w: HERO, t: '遅くなってごめん。ケガは？' },
      { who: 'misaki', face: 'scared', t: '大丈夫……。でも、さっきから出口のシャッターが次々に閉められてるの' },
      { who: 'misaki', face: 'joy', t: '……でも、来てくれるって信じてた。' },
      { w: HERO, t: '一緒に出よう。今度は絶対に、手を離さない' },
      { who: 'misaki', face: 'relief', t: 'うん。私も走れる。出口は2人で探そう' },
    ],
    barks: {
      hurt: ['っ……！ 平気、まだ走れる！', 'きゃっ……！'],
      weak: ['ごめん、少しだけ……すぐ追いつくから', 'はぁ……大丈夫、まだ行ける'],
      calm: ['……行ったみたい。今のうちに', 'ふぅ……見つからなかったね'],
      exit: ['出口……！ ' + HERO + '、あと少し！'],
    },
    names: { hero: HERO, girl: GIRL },
    chars: { player: () => TG.models.mallPlayer(), girl: () => TG.models.mallGirl(), mob: (i) => TG.models.civilian(i) },
    clueItem: 'bag',
    texts: { find: GIRL + 'を探せ：', rescue: GIRL + 'を助けろ', girlLabel: GIRL },
    over: { dead: HERO + '！？ ' + HERO + 'ーーーッ！！', girl: GIRL + '！？ ' + GIRL + 'ーーーっ！！' },
    ranks: { ghost: '伝説の彼氏', fox: '影の買い物客', hound: 'モールの猟犬', dog: '暴れるサラリーマン', chicken: 'ただの迷惑な客' },
    story: {
      opening: [
        { t: '日曜の午後。駅前のショッピングモール。' },
        { who: 'misaki', face: 'smile', t: 'ねえ' + HERO + '、次は2階の雑貨……じゃなくて、アクセサリー見に行こ？' },
        { t: '付き合って3年。ポケットの中には、小さな箱が入っている。今日こそ渡すつもりだった。' },
        { t: 'パンッ、パンッ！！', fx: 'shake' },
        { who: 'misaki', face: 'surprised', t: 'えっ……今の、なに……？' },
        { who: 'terrorist', face: 'intimidate', t: '全員伏せろ！！ このモールは我々が占拠した！' },
        { t: '悲鳴。逃げまどう人の波。つないでいた手が、ほどけた。' },
        { who: 'misaki', face: 'scared', t: HERO + '……っ！' },
        { w: HERO, t: GIRL + '！！ ' + GIRL + 'ーっ！！' },
        { t: '気づけば俺は、靴屋の倉庫のロッカーに隠れていた。' },
        { t: 'ガラガラガラ……館内のあちこちで、シャッターが下りていく音がする。' },
        { t: 'スマホが震える。' + GIRL + 'からのメッセージだ。' },
        { w: GIRL + '（メッセージ）', who: 'misaki', face: 'scared', riddle: true },
        { t: '……それきり、既読はつかない。' },
        { t: GIRL + 'を見つけて、2人でここから出る。絶対に。' },
      ],
      ending: [
        { t: '重い扉を押し開けると、夕方の風が吹き込んできた。' },
        { who: 'misaki', face: 'joy', t: '……' + HERO + '。来てくれるって、信じてた。' },
        { w: HERO, t: '当たり前だろ。……あのさ、' + GIRL + '。' },
        { t: 'ポケットの小さな箱は、まだそこにあった。' },
        { who: 'police', face: 'serious', t: '大丈夫ですか！ こちらへ！！ 中の人ですね？' },
        { who: 'police', face: 'relief', t: '2人とも無事でよかった。……よく、ここまで来ましたね' },
        { who: 'police', face: 'gentle', t: '中の人たちも、必ず助け出します。もう安心してください' },
        { who: 'misaki', face: 'relief', t: '……うん。' + HERO + '、ありがとう' },
        { t: '……プロポーズは、もう少し落ち着いてからにしよう。' },
      ],
    },
  };
})();
