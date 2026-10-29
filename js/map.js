// 〇〇にテロリスト — ステージ「学校」：校舎マップと、ステージ固有の設定（敵・白石さんの居場所・物語・人物）
// 1セル = 1m。x が東西（右が東）、z が南北（下が南）。
// ステージは TG.STAGES に登録する。共通のゲームルールは game.js 側にある。
window.TG = window.TG || {};
TG.STAGES = TG.STAGES || {};

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

  // 平屋なので、ゲーム上の座標がそのまま3Dの座標になる
  const map = {
    W, H, T, F, grid, floor, rooms, lockers, get, solid, sight, low, roomAt,
    floors: 1, portal: null, floorOf: () => 0, wx: (x) => x, wy: () => 0,
    // カメラが越えてはいけない物（ロッカーや棚の上は越えてよい）
    camWall: (x, z) => { const t = get(x, z); return t === T.WALL || t === T.TREE; },
    radarColor: (t) => (t === T.WALL || t === T.LOCKER || t === T.SHELF ? '#8fe0b0' : t === T.TREE ? '#3f8a5c' : t === T.FENCE || t === T.GATE || t === T.BACKGATE ? '#5aa07a' : null),
  };
  TG.map = map; // world.js（学校の3D）が参照する

  // ===================== ステージ設定 =====================
  const D = Math.PI / 180;
  const S = 0, N = 180 * D, E = 90 * D, Wd = -90 * D;

  // 敵の定義。route: [x, z, 待ち秒, 見回す向き...]
  const ENEMIES = {
    g2a: { room: '2a', route: [[20, 10, 6, Wd, S], [20, 6, 5, Wd, E]] },
    corr: { route: [[6, 15, 2, N, S], [31, 15, 1, N], [57, 15, 2, N, S], [31, 15, 1, S]] },
    g1a: { room: '1a', route: [[11, 4, 3, Wd, E], [11, 11, 3, E, Wd]] },
    g2b: { room: '2b', route: [[33, 11, 3, Wd, E], [33, 4, 3, E, Wd]] },
    gmus: { room: 'music', route: [[43, 9, 4, N, Wd, E, S]] },
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
  const HOSTAGE_SPOTS = [[2, 4], [2, 5], [2, 6], [2, 9], [2, 10], [2, 11]];
  const hostages = [];
  [['1a', 5], ['2a', 16], ['2b', 27], ['3a', 49]].forEach(([, x0]) => {
    HOSTAGE_SPOTS.forEach(([dx, z], i) => hostages.push({ ...C(x0 + dx, z), face: -Math.PI / 2 + (((i * 37) % 10) - 5) * 0.04, i: i + x0 }));
  });

  const HERO = 'ユウト', GIRL = '白石さん';

  // クラスメートの目撃情報が指す範囲（レーダーと地図に、重なった部分が出る）
  const EAST = { x0: 32, z0: 0, x1: 63, z1: 45 }, WEST = { x0: 0, z0: 0, x1: 31, z1: 45 };
  const NORTH = { x0: 4, z0: 3, x1: 59, z1: 13 }, SOUTH = { x0: 4, z0: 17, x1: 59, z1: 27 }, OUTSIDE = { x0: 0, z0: 28, x1: 63, z1: 45 };
  const line = (short, text, rect) => ({ short, line: '「' + text + '」', rect });
  const JANITOR = { x0: 40, z0: 17, x1: 50, z1: 27 };
  // クラスメートの立ち絵の割り当て（佐藤くん／男子／女子）
  const BOY_SATO = { cast: 'sato', faces: ['worried', 'serious', 'relief'] };
  const GIRL_C = { i: 101, name: '高橋さん', cast: 'classmate_girl', faces: ['worried', 'surprised', 'relief'] };
  // 職員室に隠れている先生（スーツ姿の3Dモデル）
  const teacherModel = () => TG.models.human({ kind: 'adultM', top: 0x3a4250, inner: 0xf4f4f0, pants: 0x2e3440, shoes: 0x1c1a18, hair: 0x15120f, hairStyle: 'short', skin: 0xe2b48f, brow: 'worried', mouth: 'frown', scale: 1.05 });
  const RIDDLE = 'この女は別の場所に閉じ込めておけ。', RIDDLE_HINT = '誰か見ていないか？';

  TG.STAGES.school = {
    id: 'school',
    order: 1,
    title: '学校にテロリスト',
    place: '舞台：中学校',
    desc: '5時間目の授業中、覆面の男たちが教室に。隠れているクラスメートから話を聞き出し、連れ去られた白石さんの居場所を突き止めろ。',
    goal: 'ゴール：白石さんと裏門から脱出',
    map,
    buildWorld: (group) => {
      const r = TG.world.build(group);
      r.onExit = () => { r.backGate.visible = false; };
      r.reset = () => { r.backGate.visible = true; };
      return r;
    },
    sky: 0x9fb4c4,
    par: 420,
    titleCam: { x: 32, z: 22, r: 34, h: 26 },
    // カメラの高さの上限（屋内は天井の少し下）
    camTop: (x, z) => ((x >= 4 && x <= 60 && z >= 3 && z <= 28) || (x >= 5 && x <= 15 && z >= 31 && z <= 40) ? 2.62 : 3.6),
    enemies: ENEMIES,
    // hold は白石さんの見張り。居場所に合わせて配置が決まる
    lists: {
      easy: ['g2a', 'corr', 'hold', 'entr', 'yard', 'janitor'],
      normal: ['g2a', 'corr', 'g2b', 'gmus', 'hold', 'entr', 'yard', 'gate', 'east', 'janitor'],
      hard: ['g2a', 'corr', 'g1a', 'g2b', 'gmus', 'hold', 'g3a', 'entr', 'staff', 'yard', 'gate', 'back', 'east', 'janitor', 'boss'],
    },
    start: { locker: { x: 25, z: 4 } },
    startRoom: '2a',
    leave: { text: '教室から出ろ', pos: { x: 24, z: 14.2 }, label: '出口' },
    key: { ...C(48, 22), text: '裏門の鍵を探せ', ask: '誰か知らないか？', label: '鍵' },
    exits: [{ x: 62.5, z: 37.5, label: '裏門' }],
    exitText: GIRL + 'と裏門へ',
    hostages,
    // 白石さんの居場所の候補。開始ごとにどれか1つ。
    // 覆面の男は場所を言わない。手がかりは、隠れているクラスメートの目撃情報（talk）と、
    // 居場所に近い廊下・通り道に落ちているキーホルダー（charm：拾うと居場所が分かる）
    girlSpots: [
      { id: 'music', room: 'music', pos: C(46, 6), face: Math.PI, hint: RIDDLE_HINT, riddle: RIDDLE,
        charm: C(45, 15), guard: [[40, 11, 3, E], [46, 12, 3, N, Wd]],
        talk: {
          dir: [line('東側', '廊下を東の方へ引っぱられていったよ', EAST), line('東側', '東の階段のほうへ連れていかれた気がする', EAST)],
          zone: [line('北側の教室', '廊下の北側の教室のどれかに入っていった', NORTH), line('北側の教室', '北側の部屋に押し込まれてるのが見えた', NORTH)],
          feat: [line('ピアノの音', 'さっき、ピアノが『ジャーン』って鳴った', null), line('ピアノの音', '合唱の練習をする部屋だって言ってた', null)],
        } },
      { id: 'infirm', room: 'infirm', pos: C(19, 23), face: -Math.PI / 2, hint: RIDDLE_HINT, riddle: RIDDLE,
        charm: C(17, 15), guard: [[18, 19, 4, S, E], [20, 24, 3, N, Wd]],
        talk: {
          dir: [line('西側', '西の方……職員室のほうへ歩かされてた', WEST), line('西側', '廊下を西に連れていかれたよ', WEST)],
          zone: [line('南側の部屋', '廊下の南側の部屋に入っていったと思う', SOUTH), line('南側の部屋', '昇降口の並びの部屋のどれかだよ', SOUTH)],
          feat: [line('『寝かせとけ』', '『ケガ人は寝かせとけ』って聞こえた', null), line('消毒液のにおい', '消毒液のにおいがする部屋って言ってた', null)],
        } },
      { id: 'lab', room: 'lab', pos: C(54, 22), face: Math.PI, hint: RIDDLE_HINT, riddle: RIDDLE,
        charm: C(54, 15), guard: [[55, 19, 4, S, Wd], [54, 25, 3, N, E]],
        talk: {
          dir: [line('東側', '東の端の方へ連れていかれたよ', EAST), line('東側', '廊下をずっと東に歩かされてた', EAST)],
          zone: [line('南側の部屋', '廊下の南側の部屋に入っていった', SOUTH), line('南側の部屋', '用務員室の並びのどこかだと思う', SOUTH)],
          feat: [line('薬品のにおい', 'なんか薬品くさいにおいがしてた', null), line('薬品のにおい', '『ガスの元栓、閉めとけよ』って声がした', null)],
        } },
      { id: 'shed', room: 'shed', pos: C(9, 35), face: Math.PI / 2, hint: RIDDLE_HINT, riddle: RIDDLE,
        charm: C(17, 33), guard: [[10, 33, 4, S, E], [12, 35, 3, Wd, N]],
        talk: {
          dir: [line('西側', '西の方へ連れていかれた', WEST), line('西側', '職員室の窓の外を通っていったよ', WEST)],
          zone: [line('校舎の外', '窓から見えた。校舎の外に連れ出されてた', OUTSIDE), line('校舎の外', '昇降口から外に出ていったよ', OUTSIDE)],
          feat: [line('体育の用具', '体育で使う物をしまう所って言ってた', null), line('体育の用具', 'マットとか跳び箱がある所だって', null)],
        } },
    ],
    // 隠れているクラスメート。毎回このうち count 人がいる（白石さんと同じ部屋の子はいない）。
    // 近づいて「話す」と、白石さんの居場所について知っていることを1つ教えてくれる
    informants: {
      // 先生・佐藤くん・高橋さん（隠れ場所は毎回ちがう）の3人。3人の話を合わせると居場所がしぼれる
      pick: (pool, shuffle) => ['teacher', 'sato', 'classmate_girl'].map((k) => shuffle(pool.filter((c) => c.cast === k))[0]).filter(Boolean),
      spots: [
        // cast / faces：吹き出しの立ち絵（話しかけ中・ヒント・鍵の話の表情）
        { i: 100, name: '佐藤くん', ...C(13, 10), face: Math.PI, room: '1a', always: true, ...BOY_SATO },
        { name: '先生', ...C(8, 24), face: Math.PI, room: 'staff', always: true, cast: 'teacher', faces: ['panic', 'serious', 'relief'], model: teacherModel },
        { ...C(24, 21), face: E, room: 'entr', ...GIRL_C },
        { ...C(46, 25), face: N, room: 'janitor', ...GIRL_C },
        { ...C(50, 32), face: N, room: 'yard', ...GIRL_C },
        { ...C(31, 1), face: S, room: 'backyard', ...GIRL_C },
        { ...C(57, 11), face: Wd, room: '3a', ...GIRL_C },
        { ...C(46, 11), face: N, room: 'music', ...GIRL_C },
        { ...C(19, 23), face: Wd, room: 'infirm', ...GIRL_C },
      ],
      hints: (spot) => spot.talk,
      // 白石さんを助けたあとに話しかけると、裏門の鍵のありかを教えてくれる
      keyHints: [
        line('用務員室のあたり', '白石さん、無事でよかった……！ 裏門の鍵なら、用務員さんがいつも腰に下げてたよ', JANITOR),
        line('用務員室のあたり', '鍵？ 用務員室の机の上に、鍵束が置きっぱなしになってるのを見た', JANITOR),
        line('用務員室のあたり', '白石さん！ ……鍵なら、校舎の南側、東寄りの用務員室だと思う', JANITOR),
      ],
    },
    // 白石さんの立ち絵（表情ごと）。助けたときの会話と、物語の場面で出る
    // 会話に出る人物（立ち絵を先に読み込む）。白石さんは救出対象
    cast: ['shiraishi', 'teacher', 'sato', 'classmate_girl', 'terrorist', 'leader', 'police'],
    heroine: 'shiraishi',
    // 白石さんと鍵の場所は、話を聞いて自分で探す（ルート・目印は出さない）
    noGuide: true,
    rescueTalk: [
      { who: 'shiraishi', face: 'surprised', t: '……え？ ' + HERO + 'くん……！？ どうして、ここに……' },
      { w: HERO, t: '助けに来た。ケガはない？' },
      { who: 'shiraishi', face: 'scared', t: 'う、うん……大丈夫。でも、外にはあの人たちがいっぱいいて……' },
      { who: 'shiraishi', face: 'tears', t: '怖かった……。ずっと、誰も来てくれないんじゃないかって……' },
      { w: HERO, t: 'もう大丈夫。一緒にここを出よう。裏門から抜けられるはずだ' },
      { who: 'shiraishi', face: 'relief', t: '……うん。' + HERO + 'くんについていく。' },
      { w: HERO, t: 'ただ、裏門には鍵がかかってる。鍵のありかが分かれば……' },
      { who: 'shiraishi', face: 'normal', t: 'みんなも、どこかに隠れてるはずだよ。誰か知ってるかも。聞いてみよう？' },
      { who: 'shiraishi', face: 'close', t: '……来てくれて、ありがとう。' },
    ],
    // 一緒に逃げている間の白石さんの一言（操作は止めない）
    barks: {
      hurt: ['きゃっ……！', '痛っ……！', 'だ、大丈夫……！'],
      weak: ['ご、ごめん……まだ歩けるから……', 'はぁ、はぁ……置いていかないで……'],
      calm: ['……行ったみたい。', 'はぁ……見つからなかったね'],
      key: ['鍵、あったね……！ 早く行こう'],
      exit: ['裏門……！ もうすぐだよ、' + HERO + 'くん'],
    },
    names: { hero: HERO, girl: GIRL },
    chars: { player: () => TG.models.player(), girl: () => TG.models.girl(), mob: (i) => TG.models.student(i) },
    clueItem: 'charm',
    texts: { find: GIRL + 'を探せ：', rescue: GIRL + 'を助けろ', girlLabel: GIRL },
    over: { dead: HERO + '？ ' + HERO + '！？ ' + HERO + 'ーーーーッ！！', girl: GIRL + '！？ ' + GIRL + 'ーーーん！！' },
    ranks: { ghost: '伝説の帰宅部', fox: '気配を消せる男', hound: '校内の猟犬', dog: 'あばれる中学2年生', chicken: 'ただの迷惑な生徒' },
    story: {
      opening: [
        { t: '――5時間目。数学の授業。' },
        { who: 'teacher', face: 'serious', t: 'じゃあ、この二次方程式を……そうだな、' + HERO + '。' },
        { t: 'ぼんやり窓の外を眺めながら、僕はいつもの妄想をしていた。' },
        { t: '「もし今、この教室にテロリストが入ってきたら――」' },
        { t: 'ガラッ！！！', fx: 'shake' },
        { who: 'terrorist', face: 'intimidate', t: '全員動くな！！ この学校は我々が占拠した！' },
        { who: 'teacher', face: 'panic', t: 'み、みんな伏せろ！ 先生の後ろに――' },
        { who: 'terrorist', face: 'angry', t: '黙れ！ 教師も生徒も、壁際に並べ！' },
        { t: '悲鳴。倒れる椅子。誰かの筆箱が床に散らばる。' },
        { t: '……嘘だろ。妄想が、現実になった。' },
        { t: '混乱のすきに、僕は教室の一番後ろ、掃除用具ロッカーへ滑り込んだ。' },
        { who: 'terrorist', face: 'sneer', t: 'おい、そこの女。こっちに来い。' },
        { who: 'shiraishi', face: 'scared', t: 'や……やだ……っ！' },
        { t: '白石美月さん。クラスで、いや、学校でいちばん……僕がずっと好きだった人。' },
        { who: 'terrorist', face: 'sneer', riddle: true },
        { t: '白石さんは、どこかへ連れていかれた。……どこへ？' },
        { t: 'ほかにも隠れているクラスメートがいるはずだ。誰か、見ていたかもしれない。' },
        { t: '……今、動けるのは僕だけだ。' },
        { t: GIRL + 'を助け出して、2人でここから抜け出す。絶対に。' },
      ],
      ending: [
        { t: '裏門の外。パトカーの赤い光の中で、僕たちはやっと足を止めた。' },
        { who: 'shiraishi', face: 'tears', t: '……ありがとう。ずっと、怖かった。' },
        { who: 'shiraishi', face: 'smile', t: '来てくれるって、なんとなく思ってた。……なんでだろうね。' },
        { w: HERO, t: 'あ、あのさ、白石さん。俺、ずっと――' },
        { who: 'police', face: 'serious', t: '君たち！ 無事か！！ 中の生徒だな？' },
        { who: 'police', face: 'relief', t: '……よく2人で出てこられたな。もう大丈夫だ。' },
        { who: 'police', face: 'gentle', t: '先生やほかの生徒たちも、すぐに助け出す。安心しなさい。' },
        { who: 'shiraishi', face: 'relief', t: '……よかった。' },
        { t: '……続きは、また今度。' },
      ],
    },
  };

  // 難易度：敵の人数（ステージごと）に加えて、視界の広さと受けるダメージを変える
  TG.DIFFS = TG.DIFFS || {
    easy: { name: 'かんたん', sight: 0.75, dmg: 0.5 },
    normal: { name: 'ふつう', sight: 0.9, dmg: 0.75 },
    hard: { name: 'むずかしい', sight: 1, dmg: 1 },
  };
})();
