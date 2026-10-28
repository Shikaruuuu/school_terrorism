// 学校にテロリスト — 校舎マップとモード設定
// 1セル = 1m。x が東西（右が東）、z が南北（下が南）。
window.TG = window.TG || {};

(function () {
  const W = 64, H = 46;

  // タイル種別
  const T = {
    OUT: 0, FLOOR: 1, WALL: 2, DESK: 3, LOCKER: 4, TREE: 5, FENCE: 6,
    GATE: 7, SHELF: 8, TDESK: 9, PIANO: 10, BOX: 11, BIKE: 12, BED: 13, BACKGATE: 14,
  };
  // 通れない
  const SOLID = new Set([T.WALL, T.DESK, T.LOCKER, T.TREE, T.FENCE, T.GATE, T.SHELF, T.TDESK, T.PIANO, T.BOX, T.BIKE, T.BED, T.BACKGATE]);
  // 視線を遮る（背が高い）
  const SIGHT = new Set([T.WALL, T.LOCKER, T.TREE, T.SHELF]);
  // しゃがんでいれば視線を遮る（背が低い）
  const LOW = new Set([T.DESK, T.TDESK, T.PIANO, T.BOX, T.BIKE, T.BED]);

  // 床の種類
  const F = { GRASS: 0, CORR: 1, WOOD: 2, TILE: 3, DIRT: 4, MAT: 5 };

  const grid = new Uint8Array(W * H);
  const floor = new Uint8Array(W * H);
  const rooms = [];
  const lockers = [];

  const inB = (x, z) => x >= 0 && z >= 0 && x < W && z < H;
  const set = (x, z, t) => { if (inB(x, z)) grid[z * W + x] = t; };
  const get = (x, z) => (inB(x, z) ? grid[z * W + x] : T.WALL);
  const setF = (x, z, f) => { if (inB(x, z)) floor[z * W + x] = f; };
  function rect(x0, z0, x1, z1, t) { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) set(x, z, t); }
  function rectF(x0, z0, x1, z1, f) { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) setF(x, z, f); }
  function box(x0, z0, x1, z1) {
    for (let x = x0; x <= x1; x++) { set(x, z0, T.WALL); set(x, z1, T.WALL); }
    for (let z = z0; z <= z1; z++) { set(x0, z, T.WALL); set(x1, z, T.WALL); }
  }
  function locker(x, z, face) { set(x, z, T.LOCKER); lockers.push({ x, z, face }); }
  function room(id, name, x0, z0, x1, z1, f) {
    rooms.push({ id, name, x0, z0, x1, z1 });
    rectF(x0, z0, x1, z1, f);
  }

  // ---- 屋外 ----
  rectF(0, 0, W - 1, H - 1, F.GRASS);
  rectF(16, 29, 58, 43, F.DIRT); // 校庭
  for (let x = 0; x < W; x++) { set(x, 0, T.FENCE); set(x, H - 1, T.FENCE); }
  for (let z = 0; z < H; z++) { set(0, z, T.FENCE); set(W - 1, z, T.FENCE); }
  // 正門（鎖で封鎖）
  rect(29, H - 1, 34, H - 1, T.GATE);
  // 裏門（東）
  rect(W - 1, 36, W - 1, 38, T.BACKGATE);

  // ---- 校舎 ----
  rect(4, 3, 59, 27, T.FLOOR);
  rectF(4, 3, 59, 27, F.CORR);
  box(4, 3, 59, 27);
  for (let x = 4; x <= 59; x++) { set(x, 13, T.WALL); set(x, 17, T.WALL); }
  [15, 26, 37, 48].forEach((x) => { for (let z = 3; z <= 13; z++) set(x, z, T.WALL); });
  [13, 22, 31, 40, 50].forEach((x) => { for (let z = 17; z <= 27; z++) set(x, z, T.WALL); });
  // 非常口（廊下の両端）
  set(4, 15, T.FLOOR); set(4, 16, T.FLOOR);
  set(59, 15, T.FLOOR); set(59, 16, T.FLOOR);
  room('corr', '1階廊下', 5, 14, 58, 16, F.CORR);

  // 北側の教室
  const classrooms = [
    ['1a', '1年A組', 5], ['2a', '2年A組', 16], ['2b', '2年B組', 27], ['music', '音楽室', 38], ['3a', '3年A組', 49],
  ];
  classrooms.forEach(([id, name, x0]) => {
    const x1 = x0 + 9;
    room(id, name, x0, 4, x1, 12, F.WOOD);
    set(x0 + 1, 13, T.FLOOR); set(x0 + 2, 13, T.FLOOR); // 前の扉
    set(x0 + 7, 13, T.FLOOR); set(x0 + 8, 13, T.FLOOR); // 後ろの扉
    locker(x1, 4, -Math.PI / 2);
    locker(x1, 5, -Math.PI / 2);
    if (id === 'music') {
      rect(x0 + 1, 5, x0 + 2, 6, T.PIANO);
      [6, 8, 10].forEach((z) => { for (let x = x0 + 4; x <= x0 + 7; x += 1) if (x !== x0 + 6) set(x, z, T.DESK); });
    } else {
      set(x0 + 1, 7, T.TDESK); set(x0 + 1, 8, T.TDESK);
      [x0 + 3, x0 + 5, x0 + 7].forEach((x) => [5, 7, 9, 11].forEach((z) => set(x, z, T.DESK)));
    }
  });

  // 南側の部屋
  room('staff', '職員室', 5, 18, 12, 26, F.WOOD);
  set(7, 17, T.FLOOR); set(8, 17, T.FLOOR);
  rect(6, 20, 7, 23, T.TDESK); rect(10, 20, 11, 23, T.TDESK);
  rect(5, 26, 7, 26, T.SHELF); rect(10, 26, 12, 26, T.SHELF);

  room('infirm', '保健室', 14, 18, 21, 26, F.TILE);
  set(16, 17, T.FLOOR); set(17, 17, T.FLOOR);
  rect(15, 20, 16, 21, T.BED); rect(15, 24, 16, 25, T.BED);
  set(21, 19, T.SHELF); set(21, 20, T.SHELF);
  locker(21, 25, -Math.PI / 2);

  room('entr', '昇降口', 23, 18, 30, 26, F.TILE);
  for (let x = 24; x <= 29; x++) set(x, 17, T.FLOOR);
  for (let x = 25; x <= 28; x++) set(x, 27, T.FLOOR);
  rect(23, 20, 24, 20, T.SHELF); rect(29, 20, 30, 20, T.SHELF);
  rect(23, 23, 24, 23, T.SHELF); rect(29, 23, 30, 23, T.SHELF);

  room('bcast', '放送室', 32, 18, 39, 26, F.CORR);
  set(35, 17, T.FLOOR); set(36, 17, T.FLOOR);
  rect(33, 24, 37, 25, T.TDESK);
  rect(39, 19, 39, 21, T.SHELF);

  room('janitor', '用務員室', 41, 18, 49, 26, F.CORR);
  set(43, 17, T.FLOOR); set(44, 17, T.FLOOR);
  rect(46, 19, 49, 19, T.SHELF); rect(42, 23, 43, 25, T.TDESK);
  locker(49, 25, -Math.PI / 2);

  room('lab', '理科室', 51, 18, 58, 26, F.TILE);
  set(53, 17, T.FLOOR); set(54, 17, T.FLOOR);
  rect(52, 20, 53, 21, T.TDESK); rect(56, 20, 57, 21, T.TDESK);
  rect(52, 24, 53, 25, T.TDESK); rect(56, 24, 57, 25, T.TDESK);

  // ---- 体育倉庫 ----
  box(5, 31, 14, 39);
  set(14, 34, T.FLOOR); set(14, 35, T.FLOOR);
  room('shed', '体育倉庫', 6, 32, 13, 38, F.MAT);
  rect(6, 32, 7, 33, T.BOX); rect(11, 37, 13, 38, T.BOX); set(6, 38, T.BOX);

  // ---- 屋外の障害物 ----
  // 自転車置き場
  rect(44, 31, 55, 31, T.BIKE);
  // 木
  [[2, 30], [2, 34], [2, 38], [2, 42], [8, 43], [14, 43], [20, 43], [25, 43], [38, 43], [43, 43],
    [49, 43], [55, 43], [61, 43], [61, 33], [18, 33], [24, 37], [36, 35], [52, 39], [10, 1], [30, 1], [50, 1], [61, 7], [2, 9]]
    .forEach(([x, z]) => set(x, z, T.TREE));
  room('yard', '校庭', 15, 28, 62, 44, F.DIRT);
  room('backyard', '校舎裏', 1, 1, 62, 2, F.GRASS);

  // ---- 周回ルート用のヘルパ ----
  const solid = (x, z) => SOLID.has(get(x, z));
  const sight = (x, z) => SIGHT.has(get(x, z));
  const low = (x, z) => LOW.has(get(x, z));

  function roomAt(x, z) {
    const cx = Math.floor(x), cz = Math.floor(z);
    for (const r of rooms) if (cx >= r.x0 && cx <= r.x1 && cz >= r.z0 && cz <= r.z1) return r;
    if (cz >= 28 || cz <= 2 || cx <= 3 || cx >= 60) return { id: 'out', name: '屋外' };
    return { id: 'corr', name: '1階廊下' };
  }

  TG.map = { W, H, T, F, grid, floor, rooms, lockers, get, solid, sight, low, roomAt };

  // ===================== モード設定 =====================
  const D = Math.PI / 180;
  const S = 0, N = 180 * D, E = 90 * D, Wd = -90 * D;

  // 敵の定義。route: [x, z, 待ち秒, 見回す向き...]
  const ENEMIES = {
    g2a: { room: '2a', route: [[20, 10, 6, Wd, S], [20, 6, 5, Wd, E]] },
    corr: { route: [[6, 15, 2, N, S], [31, 15, 1, N], [57, 15, 2, N, S], [31, 15, 1, S]] },
    g1a: { room: '1a', route: [[11, 4, 3, Wd, E], [11, 11, 3, E, Wd]] },
    g2b: { room: '2b', route: [[33, 11, 3, Wd, E], [33, 4, 3, E, Wd]] },
    gmus: { room: 'music', route: [[43, 9, 4, N, Wd, E, S]] },
    gmus2: { room: 'music', route: [[40, 11, 3, E], [46, 12, 3, N, Wd]] },
    g3a: { room: '3a', route: [[55, 4, 3, Wd, E], [55, 11, 3, E, Wd]] },
    entr: { route: [[26, 25, 4, S, E, Wd], [27, 19, 3, N, E]] },
    staff: { room: 'staff', route: [[8, 19, 3, E, Wd], [9, 25, 3, Wd, E]] },
    yard: { route: [[20, 30, 1], [40, 30, 1], [42, 41, 1], [20, 41, 1]] },
    gate: { route: [[31, 42, 5, N, E, Wd]] },
    back: { route: [[3, 2, 2, E], [60, 2, 2, Wd]] },
    east: { route: [[61, 29, 2, S, Wd], [61, 41, 3, N, Wd]] },
    janitor: { room: 'janitor', route: [[45, 22, 4, N, Wd, E]] },
    boss: { room: 'bcast', boss: true, route: [[35, 21, 5, N, Wd, E, S]] },
  };

  const C = (x, z) => ({ x: x + 0.5, z: z + 0.5 });

  // 人質（教室で座らされている生徒）
  function hostageSpots(x0, n) {
    const out = [];
    const spots = [[2, 4], [2, 5], [2, 6], [2, 9], [2, 10], [2, 11], [4, 4], [6, 12]];
    for (let i = 0; i < n; i++) out.push(C(x0 + spots[i][0], spots[i][1]));
    return out;
  }

  const commonItems = [
    { type: 'chalk', ...C(6, 9), n: 3 },
    { type: 'chalk', ...C(28, 9), n: 3 },
    { type: 'chalk', ...C(51, 9), n: 3 },
    { type: 'ext', ...C(6, 14) },
    { type: 'ext', ...C(57, 16) },
    { type: 'ext', ...C(55, 18) },
    { type: 'med', ...C(19, 19) },
    { type: 'med', ...C(9, 24) },
    { type: 'med', ...C(60, 3) },
    { type: 'box', ...C(9, 37) },
    { type: 'tape', ...C(48, 24), n: 3 },
  ];

  TG.MODES = {
    escape: {
      id: 'escape',
      kind: 'STORY 1',
      name: '1人で脱出編',
      hint: '誰にも見つからずに学校を抜け出し、警察へ駆け込め。',
      goal: 'ゴール：裏門から脱出',
      enemies: {
        easy: ['g2a', 'corr', 'entr', 'yard', 'janitor'],
        normal: ['g2a', 'corr', 'g2b', 'gmus', 'entr', 'yard', 'gate', 'east', 'janitor'],
        hard: ['g2a', 'corr', 'g1a', 'g2b', 'gmus', 'g3a', 'entr', 'staff', 'yard', 'gate', 'back', 'east', 'janitor', 'boss'],
      },
      items: [...commonItems, { type: 'key', ...C(48, 22) }],
      start: { inv: { chalk: 2 } },
      hostages: { '1a': 6, '2a': 7, '2b': 6, '3a': 6, music: 0 },
    },
    rescue: {
      id: 'rescue',
      kind: 'STORY 2',
      name: '好きな子を救え',
      hint: '音楽室に連れ去られた白石さんを助け出し、2人で学校を抜け出せ。',
      goal: 'ゴール：白石さんと裏門から脱出',
      enemies: {
        easy: ['g2a', 'corr', 'gmus', 'entr', 'yard', 'janitor'],
        normal: ['g2a', 'corr', 'g2b', 'gmus', 'gmus2', 'entr', 'yard', 'gate', 'east', 'janitor'],
        hard: ['g2a', 'corr', 'g1a', 'g2b', 'gmus', 'gmus2', 'g3a', 'entr', 'staff', 'yard', 'gate', 'back', 'east', 'janitor', 'boss'],
      },
      items: [...commonItems, { type: 'key', ...C(48, 22) }, { type: 'stun', ...C(10, 19) }],
      start: { inv: { chalk: 2 } },
      hostages: { '1a': 6, '2a': 6, '2b': 6, '3a': 6, music: 0 },
      girl: C(46, 6),
    },
    suppress: {
      id: 'suppress',
      kind: 'STORY 3',
      name: 'テロリストを倒せ',
      hint: '1人ずつ倒して武器を奪い、仲間を解放して、学校を取り戻せ。',
      goal: 'ゴール：テロリスト全員を鎮圧',
      enemies: {
        easy: ['g2a', 'corr', 'gmus', 'entr', 'yard', 'boss'],
        normal: ['g2a', 'corr', 'g1a', 'gmus', 'g3a', 'entr', 'yard', 'janitor', 'boss'],
        hard: ['g2a', 'corr', 'g1a', 'g2b', 'gmus', 'g3a', 'entr', 'staff', 'yard', 'gate', 'back', 'janitor', 'boss'],
      },
      items: [...commonItems, { type: 'tape', ...C(10, 25), n: 5 }],
      start: { inv: { chalk: 2, tape: 3 } },
      hostages: { '1a': 6, '2a': 7, '2b': 6, '3a': 6, music: 4 },
    },
  };

  // 難易度：敵の人数（モードごと）に加えて、視界の広さと受けるダメージを変える
  TG.DIFFS = {
    easy: { name: 'かんたん', sight: 0.75, dmg: 0.5 },
    normal: { name: 'ふつう', sight: 0.9, dmg: 0.75 },
    hard: { name: 'むずかしい', sight: 1, dmg: 1 },
  };
  TG.ENEMIES = ENEMIES;
  TG.hostageSpots = hostageSpots;
  TG.cellCenter = C;
  TG.PLAYER_START = { locker: { x: 25, z: 4 }, x: 24.5, z: 4.5 };
  TG.BACKGATE = { x: 62.5, z: 37.5 };
})();
