// 〇〇にテロリスト — 差し替えできる3Dアセット（GLB/glTF）の一覧と読み込み
//
// しくみ：
//   ・家具や人物には ID（'school/desk'、'char/shiraishi' など）がある
//   ・下の MANIFEST に GLB のパスを書いて assets/models/ に置くと、その形に差し替わる
//   ・書いていない（null の）間は、今まで通りコードで作った形（手続き生成）を使う。読み込みに失敗したときも同じ
//   ・当たり判定・移動・イベントはマップのマス（map.js / mall.js）だけで決まり、見た目の形とは関係しない
//     → 形を差し替えても、通れる場所やイベントの位置は変わらない
//
// GLB の作り方の決まり（docs/3d_assets.md に詳しく）：
//   単位はメートル、+Z が正面、原点は床の中心（人物は足元）。家具は 1 マスに収まる大きさ
//   人物はリグ付きで、アニメーション名を clips に書く（idle / walk / run / crouch / crouchWalk / sit / down）
window.TG = window.TG || {};
(function () {
  const MANIFEST = TG.ASSET_MANIFEST = Object.assign({
    // ---- 学校：普通教室キット ----
    'school/desk': null, // 例：{ url: 'assets/models/school/desk.glb' }
    'school/chair': null,
    'school/teacher_desk': null,
    'school/cleaning_locker': null,
    // ---- 人物（会話の立ち絵と同じ ID。cast.js と対応） ----
    // 例：'char/shiraishi': { url: 'assets/models/chars/shiraishi.glb', scale: 1, yaw: 0,
    //       clips: { idle: 'Idle', walk: 'Walk', run: 'Run', crouch: 'Crouch', crouchWalk: 'CrouchWalk', sit: 'Sit', down: 'Down' } }
    'char/yuto': null, 'char/shiraishi': null, 'char/sato': null, 'char/teacher': null, 'char/classmate_girl': null, 'char/student': null,
    'char/kazuya': null, 'char/misaki': null, 'char/mall_woman': null, 'char/mall_man': null, 'char/clerk': null, 'char/civilian': null,
    'char/terrorist': null, 'char/leader': null,
  }, TG.ASSET_MANIFEST || {});

  const loader = TG.GLTFLoader ? new TG.GLTFLoader() : null;
  const buffers = {};
  // GLB のバイト列を1回だけ取りに行く（人物は同じファイルから何体も作るので、毎回ここから組み立てる）
  function fetchBuffer(id) {
    const spec = MANIFEST[id];
    if (!spec || !spec.url || !loader) return Promise.resolve(null);
    if (!buffers[id]) {
      buffers[id] = fetch(spec.url).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
    }
    return buffers[id];
  }
  // 新しい glTF（シーン・アニメーション）を組み立てる。無ければ null
  function load(id) {
    return fetchBuffer(id).then((buf) => {
      if (!buf) return null;
      const spec = MANIFEST[id];
      const base = spec.url.slice(0, spec.url.lastIndexOf('/') + 1);
      return new Promise((res) => loader.parse(buf, base, res, (e) => { console.warn('GLB の読み込みに失敗：' + id, e); res(null); }));
    });
  }

  // 家具：形を「形状＋材質」の部品に分ける（インスタンス描画用に、ノードの変形を焼き込む）
  function partsOf(gltf, spec) {
    const out = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((m) => {
      if (!m.isMesh) return;
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      if (spec && spec.scale) g.scale(spec.scale, spec.scale, spec.scale);
      out.push({ geometry: g, material: m.material, shadow: true });
    });
    return out;
  }

  // 家具をたくさん並べる。最初は手続き生成の部品で並べ、GLB が読めたら同じ配置のまま差し替える
  // parts: [{ geometry, material, shadow }]、place(o, c, i)：位置・向き（同じ c なら毎回同じ結果を返すこと）
  function instanced(group, id, parts, list, place) {
    const MT = TG.mat;
    let meshes = parts.map((p) => MT.inst(group, p.geometry, p.material, list, place, p.shadow));
    if (MANIFEST[id]) {
      load(id).then((g) => {
        if (!g) return;
        meshes.forEach((m) => { if (m) group.remove(m); });
        meshes = partsOf(g, MANIFEST[id]).map((p) => MT.inst(group, p.geometry, p.material, list, (o, c, i) => { place(o, c, i); }, p.shadow));
      });
    }
    return meshes;
  }

  TG.assets = { manifest: MANIFEST, load, partsOf, instanced };
})();
