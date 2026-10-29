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
    STORES.push({ fl: FL, name, sign });
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
    const L = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
    const add = (m) => { if (m) group.add(m); return m; };
    const list = (pred) => {
      const out = [];
      for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (pred(get(x, z), x, z)) out.push({ x, z, t: get(x, z), d: deco[idx(x, z)] });
      return out;
    };
    const col = new THREE.Color();
    function inst(geo, material, items, place) {
      if (!items.length) return null;
      const mesh = new THREE.InstancedMesh(geo, material, items.length);
      const o = new THREE.Object3D();
      items.forEach((c, i) => {
        o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
        const color = place(o, c);
        o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
        if (color !== undefined) mesh.setColorAt(i, col.set(color));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      return add(mesh);
    }
    const fy = (x) => (x >= OFF ? FLOOR_H : 0);
    const wxc = (x) => map.wx(x) + 0.5;

    // 外の地面と駐車場
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), L(0x3a3e41));
    ground.rotation.x = -Math.PI / 2; ground.position.set(FW / 2, -0.06, FH / 2); add(ground);
    for (let i = 0; i < 14; i++) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 5), new THREE.MeshBasicMaterial({ color: 0xd8d8d0 }));
      line.rotation.x = -Math.PI / 2; line.position.set(6 + i * 3.4, -0.05, FH + 6); add(line);
    }

    // 床（2階の床は1階の天井も兼ねる）
    const floorCells = list((t, x) => t !== T.WALL && t !== T.GAP && t !== T.VOID && !(x < OFF && (t === T.STAIR || t === T.PORTAL)));
    inst(new THREE.BoxGeometry(1, 0.22, 1), L(0xffffff), floorCells, (o, c) => {
      o.position.set(wxc(c.x), fy(c.x) - 0.11, c.z + 0.5);
      const fc = floorCol[idx(c.x, c.z)] || 0xd9d4ca;
      return (c.x + c.z) & 1 ? fc : new THREE.Color(fc).multiplyScalar(0.94).getHex();
    });

    // 壁：店の正面は濃い色、ほかは明るい色。1階は2階の床の下まで、2階は天井まで
    const walls = list((t) => t === T.WALL);
    const storefront = (x, z) => { const lx = map.wx(x); return z === 12 || z === 29 || ((lx === 14 || lx === 41) && z >= 17 && z <= 24); };
    inst(new THREE.BoxGeometry(1, 1, 1), L(0xffffff), walls, (o, c) => {
      const h = c.x >= OFF ? 4.0 : FLOOR_H - 0.22;
      o.scale.set(1, h, 1);
      o.position.set(wxc(c.x), fy(c.x) + h / 2, c.z + 0.5);
      return storefront(c.x, c.z) ? 0x3b4654 : (c.x + c.z) % 3 ? 0xece8e0 : 0xe4dfd5;
    });
    // 店の正面の上の帯（看板の下地）
    const fronts = walls.filter((c) => storefront(c.x, c.z));
    inst(new THREE.BoxGeometry(1.01, 0.5, 1.01), L(0xf3efe6), fronts, (o, c) => {
      o.position.set(wxc(c.x), fy(c.x) + (c.x >= OFF ? 3.4 : 3.6), c.z + 0.5);
    });

    // 天井（2階の上）と吹き抜けの天窓
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(FW, FH), L(0xe9e6dc, { emissive: 0x6a675e }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(FW / 2, FLOOR_H + 4.0, FH / 2); add(ceil);
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ color: 0xcfe6f5 }));
    sky.rotation.x = Math.PI / 2; sky.position.set(28, FLOOR_H + 3.98, 21); add(sky);
    // 照明
    const lights = [];
    for (let fl = 0; fl < 2; fl++) for (let z = 2; z < FH; z += 4) for (let x = 2; x < FW; x += 4) {
      const gx = x + fl * OFF;
      if (fl === 0 && x >= 20 && x <= 35 && z >= 17 && z <= 24) continue;
      if (get(gx, z) === T.WALL) continue;
      lights.push({ x: gx, z });
    }
    inst(new THREE.BoxGeometry(1.4, 0.05, 0.3), new THREE.MeshBasicMaterial({ color: 0xf6f8ff }), lights, (o, c) => {
      o.position.set(wxc(c.x), fy(c.x) + (c.x >= OFF ? 3.97 : FLOOR_H - 0.25), c.z + 0.5);
    });

    // 階段・エスカレーター（1階のマスに段を積む）
    const steps = list((t, x) => t === T.STAIR && x < OFF);
    const escal = (c) => c.z >= 17 && c.z <= 24;
    inst(new THREE.BoxGeometry(1, 1, 1), L(0xffffff), steps, (o, c) => {
      const h = Math.max(0.05, stairY(c.x + 0.5, c.z + 0.5));
      o.scale.set(1, h, 1);
      o.position.set(c.x + 0.5, h / 2, c.z + 0.5);
      return escal(c) ? ((c.z + c.x) & 1 ? 0x7d848c : 0x6f767e) : 0xb9b4aa;
    });
    // エスカレーターの側面（手すり）
    const rails = list((t, x) => t === T.RAIL && x < OFF);
    inst(new THREE.BoxGeometry(1, 1, 1), L(0xffffff), rails, (o, c) => {
      const near = Math.max(stairY(c.x + 1.5, c.z + 0.5), stairY(c.x - 0.5, c.z + 0.5));
      const h = near + 1.0;
      o.scale.set(0.5, h, 1);
      o.position.set(c.x + 0.5, h / 2, c.z + 0.5);
      return 0xa9c4d2;
    });
    // 2階の吹き抜けまわりのガラスの手すり
    const glass = L(0xbfe0ee, { transparent: true, opacity: 0.45 });
    const railEdges = [];
    list((t, x) => t === T.VOID && x >= OFF).forEach((c) => {
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz]) => {
        const n = get(c.x + dx, c.z + dz);
        if (n === T.FLOOR || n === T.LOW || n === T.EXIT) railEdges.push({ x: c.x, z: c.z, dx, dz });
      });
    });
    inst(new THREE.BoxGeometry(1, 1.05, 0.06), glass, railEdges, (o, c) => {
      o.position.set(wxc(c.x) + c.dx * 0.5, FLOOR_H + 0.52, c.z + 0.5 + c.dz * 0.5);
      if (c.dx) o.rotation.y = Math.PI / 2;
    });

    // 家具
    const furn = list((t) => t === T.SHELF || t === T.LOW || t === T.LOCKER);
    const byDeco = {};
    furn.forEach((c) => { (byDeco[c.d] = byDeco[c.d] || []).push(c); });
    const shelfMat = L(0xffffff);
    const lowMat = L(0xffffff);
    const SPEC = {
      [DECO.SHELF]: [0.9, 1.9, 0.9, 0x7a8590, shelfMat],
      [DECO.BOOK]: [0.9, 2.0, 0.9, 0x6b4a2e, shelfMat],
      [DECO.TV]: [0.9, 1.7, 0.7, 0x2b2f36, shelfMat],
      [DECO.MACHINE]: [0.9, 1.8, 0.9, 0x5a3a9a, shelfMat],
      [DECO.BOOTH]: [0.95, 2.1, 0.95, 0x9a3a4a, shelfMat],
      [DECO.TABLE]: [0.8, 0.75, 0.8, 0xc9a77a, lowMat],
      [DECO.COUNTER]: [1, 1.0, 0.9, 0x6e5a48, lowMat],
      [DECO.SEAT]: [0.95, 0.6, 0.8, 0x8a1f2c, lowMat],
      [DECO.BED]: [1, 0.55, 1, 0xf0eee8, lowMat],
      [DECO.SOFA]: [1, 0.65, 0.9, 0x7a5a44, lowMat],
      [DECO.PIANO]: [1, 1.0, 1, 0x141414, lowMat],
      [DECO.RACK]: [1, 1.4, 0.4, 0x5c6a7c, lowMat],
      [DECO.PLANTER]: [1, 0.7, 1, 0x4c7a3e, lowMat],
      [DECO.SHOWCASE]: [1, 0.95, 0.8, 0xdde7ec, lowMat],
      [DECO.FOUNTAIN]: [1, 0.55, 1, 0xa9c8d8, lowMat],
      [DECO.BOARD]: [0.9, 0.3, 0.9, 0x34404c, lowMat],
      [DECO.NONE]: [0.86, 2.0, 0.92, 0x7b90a6, shelfMat], // ロッカー
    };
    Object.keys(byDeco).forEach((k) => {
      const [w, h, d, color, m] = SPEC[k] || SPEC[DECO.SHELF];
      inst(new THREE.BoxGeometry(w, h, d), m, byDeco[k], (o, c) => {
        o.position.set(wxc(c.x), fy(c.x) + h / 2, c.z + 0.5);
        if (+k === DECO.MACHINE) return [0x5a3a9a, 0x2a6a9a, 0x9a3a5a][(c.x + c.z) % 3];
        if (+k === DECO.SHELF) return [0x7a8590, 0x8a7a6a, 0x6a7a8a][(c.x * 3 + c.z) % 3];
        return color;
      });
    });
    // 噴水の水と、ゲーム機の画面
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.1, 24), new THREE.MeshBasicMaterial({ color: 0x7fc4e8 }));
    water.position.set(28, 0.58, 21); add(water);
    inst(new THREE.BoxGeometry(0.7, 0.5, 0.02), new THREE.MeshBasicMaterial({ color: 0xffffff }), byDeco[DECO.MACHINE] || [], (o, c) => {
      o.position.set(wxc(c.x), fy(c.x) + 1.25, c.z + 0.5 + (c.z === 19 ? 0.46 : -0.46));
      return [0x7affd2, 0xff7ad8, 0xfff27a][(c.x + c.z) % 3];
    });
    // シネマのスクリーン
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.6), new THREE.MeshBasicMaterial({ color: 0xdfe8ff }));
    screen.position.set(48, FLOOR_H + 2.2, 4.03); add(screen);

    // 看板・案内板・非常口
    const sprite = (text, bg, fg, w, h) => {
      const c = document.createElement('canvas');
      c.width = 320; c.height = 80;
      const x = c.getContext('2d');
      x.fillStyle = bg; x.fillRect(4, 4, 312, 72);
      x.fillStyle = fg; x.font = '900 40px "Zen Kaku Gothic New", sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 160, 42);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
      s.scale.set(w || 2.2, h || 0.55, 1);
      return s;
    };
    STORES.forEach((st) => {
      const s = sprite(st.name, '#1f2a36', '#f6f1e4');
      s.position.set(st.sign[0] + 0.5, (st.fl ? FLOOR_H : 0) + (st.fl ? 3.3 : 3.5), st.sign[1]);
      add(s);
    });
    [[0.6, 14.9, '非常口'], [55.4, 27, '非常口'], [41, 0.7, '搬入口'], [28, 39.3, '正面入口']].forEach(([x, z, t]) => {
      const s = sprite(t, '#1f8a4c', '#ffffff', 1.8, 0.45);
      s.position.set(x, 2.8, z); add(s);
    });
    // フロアガイド（店の名前を階ごとに並べた案内板）
    const guide = document.createElement('canvas');
    guide.width = 512; guide.height = 512;
    const g = guide.getContext('2d');
    g.fillStyle = '#1d2733'; g.fillRect(0, 0, 512, 512);
    g.fillStyle = '#ffd34d'; g.font = '900 40px "Zen Kaku Gothic New", sans-serif'; g.fillText('FLOOR GUIDE', 24, 56);
    [[1, 'books,toys,acc,cinema,interior,arcade,music,glasses,rest,food'], [0, 'sport,cafe,goods,super,apparel,electro,drug,shoes,flower,bakery']].forEach(([fl], i) => {
      const names = STORES.filter((s) => s.fl === fl).map((s) => s.name);
      g.fillStyle = '#7fe3ff'; g.font = '900 34px "Zen Kaku Gothic New", sans-serif'; g.fillText(fl ? '2F' : '1F', 24, 118 + i * 200);
      g.fillStyle = '#f2efe6'; g.font = '700 25px "Zen Kaku Gothic New", sans-serif';
      names.forEach((n, j) => g.fillText(n, 90 + (j % 2) * 210, 118 + i * 200 + Math.floor(j / 2) * 34));
    });
    const guideTex = new THREE.CanvasTexture(guide);
    list((t) => t === T.LOW).filter((c) => c.d === DECO.BOARD).forEach((c) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: guideTex, side: THREE.DoubleSide }));
      m.position.set(wxc(c.x), fy(c.x) + 1.4, c.z + 0.5);
      add(m);
    });

    // 外：パトカー
    const policeLights = [];
    const car = (x, z, rot) => {
      const cg = new THREE.Group();
      const part = (w, h, d, c, y, zz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), L(c)); m.position.set(0, y, zz); cg.add(m); };
      part(1.8, 0.6, 4, 0xf4f4f4, 0.5, 0); part(1.82, 0.3, 4.02, 0x111111, 0.35, 0); part(1.6, 0.5, 2, 0x111111, 1.05, -0.2);
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
      r.position.set(-0.3, 1.4, -0.2);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
      b.position.set(0.3, 1.4, -0.2);
      cg.add(r, b); policeLights.push(r, b);
      cg.position.set(x, 0, z); cg.rotation.y = rot; add(cg);
    };
    car(22, FH + 5, Math.PI / 2.3); car(34, FH + 5.5, -Math.PI / 2.2); car(-5, 15, 0.1); car(FW + 5, 27, -0.1);

    return { policeLights, occluders: [shelfMat], onExit: () => {} };
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
      shut: new THREE.MeshLambertMaterial({ map: shutTex }),
      bar: new THREE.MeshLambertMaterial({ map: barTex }),
      post: new THREE.MeshLambertMaterial({ color: 0x3a3a3a }),
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
