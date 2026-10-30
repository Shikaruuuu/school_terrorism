// 〇〇にテロリスト — 普通教室の内装キット（質感の見本：1年A組・2年A組・2年B組・3年A組）
//
// 箱を並べた机や椅子をやめ、実物の作りに近い形をコードで組み立てる（手続き生成の自作モデル。権利の心配なし）
//   机：角を丸めた化粧板の天板・縁の樹脂テープ・角パイプの脚と幕板・鉄板の物入れ・足掛け・樹脂の脚キャップ・かばん掛け
//   椅子：くぼませた成形合板の座面・湾曲した背もたれ・曲げパイプの脚・横桟・脚キャップ
//   教卓・黒板（アルミ枠、粉受け、チョーク、黒板消し）・時計・スピーカー・テレビ・学級目標
//   窓（奥行きのあるサッシ、ガラス、窓台、カーテン）・腰板と幅木・後ろの棚とかばん・掃除用具ロッカー・蛍光灯（2灯の器具）
//   教科書・ノート・筆箱・机のかばん・床に落ちたプリント・倒れた椅子
//   置いた物の下と壁ぎわに、柔らかい影（AO）を敷いて接地感を出す
// 当たり判定はマップのマスのまま。見た目だけを置き換える（マスの外にはみ出さない大きさにしてある）
// GLB の家具が TG.assets に登録されていれば、机・椅子・教卓・ロッカーはそちらに差し替わる
window.TG = window.TG || {};
TG.kits = TG.kits || {};
(function () {
  const ROOMS = ['1a', '2a', '2b', '3a'];
  const WALL_H = 2.8;

  // 決まった種の乱数（同じ机はいつも同じ置き方になる）
  const rnd = (s) => { const v = Math.sin(s * 12.9898 + 4.1) * 43758.5453; return v - Math.floor(v); };

  // ---------- 形の部品 ----------
  // 角を丸めた板（厚み方向は y）。縁はわずかに面取りする
  function roundSlab(w, d, t, r, bevel) {
    const s = new THREE.Shape();
    const x0 = -w / 2, z0 = -d / 2;
    s.moveTo(x0 + r, z0);
    s.lineTo(x0 + w - r, z0); s.quadraticCurveTo(x0 + w, z0, x0 + w, z0 + r);
    s.lineTo(x0 + w, z0 + d - r); s.quadraticCurveTo(x0 + w, z0 + d, x0 + w - r, z0 + d);
    s.lineTo(x0 + r, z0 + d); s.quadraticCurveTo(x0, z0 + d, x0, z0 + d - r);
    s.lineTo(x0, z0 + r); s.quadraticCurveTo(x0, z0, x0 + r, z0);
    const b = bevel || 0;
    const g = new THREE.ExtrudeGeometry(s, { depth: t - b * 2, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 1, curveSegments: 3 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, b, 0);
    return g;
  }
  // 角を丸めた曲げパイプ（点の列をつなぎ、角は2次ベジエで丸める）
  function bentTube(points, radius, cornerR) {
    const path = new THREE.CurvePath();
    const P = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    let prev = P[0].clone();
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i], c = P[i + 1];
      if (!c) { path.add(new THREE.LineCurve3(prev, b)); break; }
      const inDir = b.clone().sub(a).normalize(), outDir = c.clone().sub(b).normalize();
      const p1 = b.clone().addScaledVector(inDir, -cornerR), p2 = b.clone().addScaledVector(outDir, cornerR);
      path.add(new THREE.LineCurve3(prev, p1));
      path.add(new THREE.QuadraticBezierCurve3(p1, b.clone(), p2));
      prev = p2;
    }
    return new THREE.TubeGeometry(path, 14, radius, 6, false);
  }

  function buildParts() {
    const MT = TG.mat;
    const { merge, B, CY } = MT;
    const frameCol = 0x7d8a82; // 学校の机らしい、くすんだ緑灰色
    const steel = MT.surface('paintsteel', frameCol);
    const steelDark = MT.surface('paintsteel', 0x6a7570);
    const oak = MT.surface('oak');
    const ply = MT.surface('plywood');
    const edge = MT.plain(0x5a3a22, 0.45);
    const plastic = MT.plain(0x1c1c1e, 0.6);
    const chrome = MT.plain(0xb8bec4, 0.25, 0.9);

    // ---- 机（ローカル：幅 x 0.65、奥行 z 0.45。+z 側に座る） ----
    const deskTop = roundSlab(0.65, 0.45, 0.024, 0.025, 0.003);
    deskTop.translate(0, 0.698, 0);
    const deskEdge = merge([
      [B(0.63, 0.02, 0.004), [0, 0.71, 0.226]], [B(0.63, 0.02, 0.004), [0, 0.71, -0.226]],
      [B(0.004, 0.02, 0.43), [0.326, 0.71, 0]], [B(0.004, 0.02, 0.43), [-0.326, 0.71, 0]],
    ]);
    const deskFrame = merge([
      // 角パイプの脚（少し内側に）
      ...[[-0.3, -0.19], [0.3, -0.19], [-0.3, 0.19], [0.3, 0.19]].map(([x, z]) => [B(0.024, 0.68, 0.024), [x, 0.35, z]]),
      // 天板の下の幕板（横と前後）
      [B(0.6, 0.035, 0.018), [0, 0.675, -0.19]], [B(0.018, 0.035, 0.36), [-0.3, 0.675, 0]], [B(0.018, 0.035, 0.36), [0.3, 0.675, 0]],
      // 脚をつなぐ下の横桟
      [B(0.018, 0.018, 0.36), [-0.3, 0.16, 0]], [B(0.018, 0.018, 0.36), [0.3, 0.16, 0]],
    ]);
    const deskBox = merge([
      [B(0.56, 0.005, 0.34), [0, 0.565, -0.02]], [B(0.56, 0.11, 0.005), [0, 0.62, -0.19]],
      [B(0.005, 0.11, 0.34), [-0.28, 0.62, -0.02]], [B(0.005, 0.11, 0.34), [0.28, 0.62, -0.02]],
    ]);
    const deskFoot = merge([
      [CY(0.009, 0.009, 0.6, 8), [0, 0.11, 0.19], [0, 0, Math.PI / 2]],
      ...[[-0.3, -0.19], [0.3, -0.19], [-0.3, 0.19], [0.3, 0.19]].map(([x, z]) => [CY(0.017, 0.015, 0.014, 8), [x, 0.007, z]]),
    ]);
    const hook = new THREE.TorusGeometry(0.018, 0.0035, 5, 10, Math.PI * 1.3);
    hook.rotateY(Math.PI / 2); hook.translate(0.335, 0.63, 0.05);

    // ---- 椅子（ローカル：座る人は +z を向く） ----
    const seat = new THREE.BoxGeometry(0.4, 0.012, 0.38, 6, 1, 6);
    {
      const p = seat.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        let y = p.getY(i) + 0.012 * ((x / 0.2) ** 2 + (z / 0.19) ** 2) * 0.6;
        if (z > 0.14) y -= (z - 0.14) * 0.22; // 前縁を下へ丸める
        p.setY(i, y);
      }
      seat.computeVertexNormals();
      seat.translate(0, 0.425, 0.01);
    }
    const back = new THREE.BoxGeometry(0.38, 0.17, 0.012, 8, 1, 1);
    {
      const p = back.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, p.getZ(i) - 0.05 * (x / 0.19) ** 2); }
      back.computeVertexNormals();
      back.rotateX(-0.14);
      back.translate(0, 0.73, -0.215);
    }
    const chairFrame = merge([
      ...[-1, 1].flatMap((s) => [
        [bentTube([[s * 0.18, 0.0, 0.17], [s * 0.18, 0.405, 0.17], [s * 0.18, 0.405, -0.13]], 0.011, 0.04), [0, 0, 0]],
        [bentTube([[s * 0.18, 0.0, -0.2], [s * 0.18, 0.405, -0.175], [s * 0.18, 0.83, -0.25]], 0.011, 0.05), [0, 0, 0]],
      ]),
      [CY(0.009, 0.009, 0.36, 8), [0, 0.39, 0.16], [0, 0, Math.PI / 2]], [CY(0.009, 0.009, 0.36, 8), [0, 0.39, -0.15], [0, 0, Math.PI / 2]],
      [CY(0.008, 0.008, 0.36, 8), [0, 0.14, -0.19], [0, 0, Math.PI / 2]],
    ]);
    const chairFoot = merge([[-0.18, 0.17], [0.18, 0.17], [-0.18, -0.2], [0.18, -0.2]].map(([x, z]) => [CY(0.015, 0.013, 0.014, 8), [x, 0.007, z]]));

    // ---- 教卓（2マス分。ローカル：長さ z 1.7、奥行 x 0.62、生徒側は +x） ----
    const podTop = roundSlab(0.66, 1.72, 0.04, 0.03, 0.006); podTop.translate(0, 0.94, 0);
    const podBody = merge([
      [B(0.025, 0.86, 1.62), [0.29, 0.47, 0]], // 生徒側の前板
      [B(0.6, 0.86, 0.025), [0, 0.47, 0.8]], [B(0.6, 0.86, 0.025), [0, 0.47, -0.8]], // 側板
      [B(0.56, 0.02, 1.56), [0, 0.42, 0]], // 中の棚板
      [B(0.6, 0.06, 1.62), [0, 0.03, 0]], // 台輪
    ]);
    const podPanel = merge([[B(0.006, 0.6, 0.7), [0.305, 0.5, -0.38]], [B(0.006, 0.6, 0.7), [0.305, 0.5, 0.38]]]);

    // ---- 掃除用具ロッカー（ローカル：扉は +z 向き、幅 0.86） ----
    const lockBody = merge([[B(0.86, 1.86, 0.5), [0, 0.98, -0.2]], [B(0.86, 0.05, 0.5), [0, 1.93, -0.2]]]);
    const lockDoor = merge([[B(0.4, 1.78, 0.012), [-0.205, 0.98, 0.057]], [B(0.4, 1.78, 0.012), [0.205, 0.98, 0.057]]]);
    const lockTrim = merge([
      ...[-1, 1].flatMap((s) => [0, 1, 2, 3, 4].map((k) => [B(0.22, 0.012, 0.006), [s * 0.205, 1.62 - k * 0.04, 0.066]])),
      [B(0.02, 0.12, 0.02), [-0.035, 1.0, 0.07]], [B(0.02, 0.12, 0.02), [0.035, 1.0, 0.07]],
      ...[[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.03], [0.4, 0.03]].map(([x, z]) => [B(0.04, 0.06, 0.04), [x, 0.03, z]]),
    ]);

    return {
      mats: { steel, steelDark, oak, ply, edge, plastic, chrome },
      desk: [{ geometry: deskTop, material: oak, shadow: true }, { geometry: deskEdge, material: edge, shadow: false }, { geometry: deskFrame, material: steel, shadow: true }, { geometry: deskBox, material: steelDark, shadow: true }, { geometry: deskFoot, material: plastic, shadow: false }, { geometry: hook, material: chrome, shadow: false }],
      chair: [{ geometry: merge([[seat, [0, 0, 0]], [back, [0, 0, 0]]]), material: ply, shadow: true }, { geometry: chairFrame, material: steel, shadow: true }, { geometry: chairFoot, material: plastic, shadow: false }],
      podium: [{ geometry: podTop, material: MT.surface('oak', 0xb88a5a), shadow: true }, { geometry: podBody, material: MT.surface('panel', 0xc8a070), shadow: true }, { geometry: podPanel, material: MT.surface('oak', 0x9a7048), shadow: false }],
      locker: (mat) => [{ geometry: lockBody, material: mat, shadow: true }, { geometry: lockDoor, material: mat, shadow: false }, { geometry: lockTrim, material: MT.plain(0x2a2e30, 0.35, 0.6), shadow: false }],
    };
  }

  // ---------- 絵 ----------
  function tex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }
  const FONT = '"Zen Kaku Gothic New", "Hiragino Sans", sans-serif';
  // 置いた物の下の柔らかい影（中心が濃く、ふちで消える）
  const blobTex = () => tex(128, 128, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
  // 壁ぎわ・天井ぎわの影（片側から消える帯）
  const edgeTex = () => tex(8, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.35, 'rgba(0,0,0,.4)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });

  // ============================================================
  TG.kits.classroom = function build(world, ctx) {
    const MT = TG.mat;
    const { merge, inst, B, CY } = MT;
    const M = ctx.map;
    const parts = buildParts();
    const pm = parts.mats;
    const rooms = M.rooms.filter((r) => ROOMS.includes(r.id));
    const roomGroups = [];
    const occluders = [];
    const blobMat = new THREE.MeshBasicMaterial({ map: blobTex(), color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const edgeMat = new THREE.MeshBasicMaterial({ map: edgeTex(), color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide });
    const lockerMat = MT.surface('paintsteel', 0xd8d4c4).clone();
    MT.worldUV(lockerMat, 2.0);
    occluders.push(lockerMat);

    rooms.forEach((r) => {
      const g = new THREE.Group();
      world.add(g);
      const x0 = r.x0, x1 = r.x1, z0 = r.z0, z1 = r.z1; // 室内のマス（壁の内側）
      const W0 = x0, W1 = x1 + 1, N0 = z0, S0 = z1 + 1; // 壁の面の座標
      const cells = (t) => { const out = []; for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (M.get(x, z) === t) out.push({ x, z }); return out; };

      // ---- 床（細いフローリング）と天井（化粧ボード） ----
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(W1 - W0, S0 - N0), MT.surface('floorOak'));
      floor.rotation.x = -Math.PI / 2; floor.position.set((W0 + W1) / 2, 0.003, (N0 + S0) / 2); floor.receiveShadow = true;
      g.add(floor);
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W1 - W0, S0 - N0), MT.surface('ceilBoard'));
      ceil.rotation.x = Math.PI / 2; ceil.position.set((W0 + W1) / 2, WALL_H - 0.004, (N0 + S0) / 2);
      g.add(ceil);

      // ---- 腰板・笠木・幅木（4面。廊下側は戸口を空ける） ----
      const runs = [];
      const doorX = [x0 + 1, x0 + 2, x0 + 7, x0 + 8];
      for (let x = W0; x < W1; x++) runs.push({ x: x + 0.5, z: N0 + 0.012, ry: 0, w: 1 });
      for (let x = W0; x < W1; x++) if (!doorX.includes(x)) runs.push({ x: x + 0.5, z: S0 - 0.012, ry: Math.PI, w: 1 });
      for (let z = N0; z < S0; z++) { runs.push({ x: W0 + 0.012, z: z + 0.5, ry: Math.PI / 2, w: 1 }); runs.push({ x: W1 - 0.012, z: z + 0.5, ry: -Math.PI / 2, w: 1 }); }
      inst(g, B(1.002, 0.9, 0.018), MT.surface('panel'), runs, (o, c) => { o.position.set(c.x, 0.53, c.z); o.rotation.y = c.ry; }, 'receive');
      inst(g, B(1.002, 0.035, 0.045), MT.surface('oak', 0x8a5a32), runs, (o, c) => { o.position.set(c.x, 0.995, c.z); o.rotation.y = c.ry; }, 'receive');
      inst(g, B(1.002, 0.08, 0.03), MT.plain(0x2a2420, 0.5), runs, (o, c) => { o.position.set(c.x, 0.04, c.z); o.rotation.y = c.ry; }, 'receive');
      // 床と壁、天井と壁の境目の影
      inst(g, new THREE.PlaneGeometry(1, 0.42), edgeMat, runs, (o, c) => { o.position.set(c.x, 0.006, c.z); o.rotation.set(-Math.PI / 2, 0, 0); o.rotateZ(c.ry); o.translateY(-0.21); }, false);
      inst(g, new THREE.PlaneGeometry(1, 0.5), edgeMat, runs, (o, c) => { o.position.set(c.x, WALL_H - 0.008, c.z); o.rotation.set(Math.PI / 2, 0, 0); o.rotateZ(-c.ry); o.translateY(0.25); }, false);

      // ---- 机と椅子 ----
      const desks = cells(TG.map.T.DESK).map((c) => {
        const k = c.x * 31 + c.z * 7;
        return { x: c.x + 0.5 + (rnd(k) - 0.5) * 0.12, z: c.z + 0.5 + (rnd(k + 1) - 0.5) * 0.1, a: Math.PI / 2 + (rnd(k + 2) - 0.5) * 0.22, k };
      });
      TG.assets.instanced(g, 'school/desk', parts.desk, desks, (o, d) => { o.position.set(d.x, 0, d.z); o.rotation.y = d.a; });
      // 椅子：机の東（生徒側）。引き出し具合と向きがばらつき、いくつかは倒れている
      const chairs = desks.map((d) => {
        const r = rnd(d.k + 9), fallen = rnd(d.k + 3) < 0.14;
        return { x: d.x + 0.42 + r * 0.16, z: d.z + (r - 0.5) * 0.18, a: -Math.PI / 2 + (rnd(d.k + 4) - 0.5) * 0.7, fallen, r };
      });
      TG.assets.instanced(g, 'school/chair', parts.chair, chairs, (o, c) => {
        o.position.set(c.x, 0, c.z); o.rotation.set(0, c.a, 0);
        if (c.fallen) { o.rotation.set(0, c.r * 6, 0); o.rotateX(-Math.PI / 2 + 0.06); o.position.y = 0.21; o.position.x += 0.22; }
      });
      // 机と椅子の下の影
      inst(g, new THREE.PlaneGeometry(0.85, 0.62), blobMat, desks, (o, d) => { o.position.set(d.x, 0.005, d.z); o.rotation.set(-Math.PI / 2, 0, d.a); }, false);
      inst(g, new THREE.PlaneGeometry(0.55, 0.55), blobMat, chairs.filter((c) => !c.fallen), (o, c) => { o.position.set(c.x, 0.005, c.z); o.rotation.set(-Math.PI / 2, 0, c.a); }, false);

      // ---- 机の上の物（教科書・ノート・筆箱）、机に掛けたかばん ----
      const books = [], notes = [], cases = [], bags = [];
      desks.forEach((d) => {
        const s = d.k;
        const n = Math.floor(rnd(s + 11) * 3);
        for (let i = 0; i < n; i++) books.push({ d, i, c: [0x2f5aa8, 0xb8402a, 0x2f7a4a, 0xe0b030, 0x6a4aa0, 0xd8d0c0][Math.floor(rnd(s + 20 + i) * 6)], dx: -0.12 + rnd(s + 30 + i) * 0.1, dz: -0.08 + rnd(s + 40 + i) * 0.06, r: (rnd(s + 50 + i) - 0.5) * 0.5 });
        if (rnd(s + 12) < 0.45) notes.push({ d, dx: 0.12, dz: 0.05, r: (rnd(s + 13) - 0.5) * 0.6 });
        if (rnd(s + 14) < 0.4) cases.push({ d, dx: 0.17, dz: -0.12, r: (rnd(s + 15) - 0.5) * 0.8, c: [0x2a2a30, 0xd84a7a, 0x3a7ad8, 0xe8e0d0][Math.floor(rnd(s + 16) * 4)] });
        if (rnd(s + 17) < 0.45) bags.push({ d, c: [0x1e2436, 0x2a2a2a, 0x3a2e24][Math.floor(rnd(s + 18) * 3)] });
      });
      const onDesk = (o, it, y) => {
        o.position.set(it.dx, y, it.dz);
        o.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), it.d.a);
        o.position.x += it.d.x; o.position.z += it.d.z;
        o.rotation.y = it.d.a + it.r;
      };
      inst(g, roundSlab(0.18, 0.26, 0.018, 0.006, 0), MT.plain(0xffffff, 0.55), books, (o, b) => { onDesk(o, b, 0.722 + b.i * 0.019); return b.c; }, false);
      inst(g, merge([[B(0.36, 0.006, 0.25), [0, 0.003, 0]], [B(0.003, 0.008, 0.25), [0, 0.006, 0]]]), MT.plain(0xf4f2ea, 0.85), notes, (o, b) => { onDesk(o, b, 0.722); }, false);
      inst(g, merge([[CY(0.025, 0.025, 0.2, 10), [0, 0.025, 0], [0, 0, Math.PI / 2]]]), MT.plain(0xffffff, 0.5), cases, (o, b) => { onDesk(o, b, 0.722); return b.c; }, false);
      // かばん：机の横のフックに掛かる、角の丸い学生かばん
      inst(g, merge([[roundSlab(0.36, 0.11, 0.26, 0.03, 0.01), [0, 0, 0]], [new THREE.TorusGeometry(0.06, 0.008, 5, 10, Math.PI), [0, 0.26, 0]]]), MT.surface('fabric', 0xffffff, { roughness: 0.75 }), bags, (o, b) => {
        o.position.set(0.39, 0.34, 0.05);
        o.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), b.d.a);
        o.position.x += b.d.x; o.position.z += b.d.z;
        o.rotation.y = b.d.a + Math.PI / 2;
        return b.c;
      });
      // 床に散らばったプリント（事件のときに落ちた）
      const papers = [];
      for (let i = 0; i < 9; i++) { const s = r.x0 * 13 + i * 7; papers.push({ x: x0 + 1.5 + rnd(s) * 7.5, z: z0 + 0.6 + rnd(s + 1) * 7.6, r: rnd(s + 2) * 6 }); }
      inst(g, new THREE.PlaneGeometry(0.21, 0.297), MT.plain(0xf2f0e8, 0.9, 0, { side: THREE.DoubleSide }), papers, (o, p) => { o.position.set(p.x, 0.008, p.z); o.rotation.set(-Math.PI / 2, 0, p.r); }, 'receive');

      // ---- 教卓（教卓の2マスの中央） ----
      const tds = cells(TG.map.T.TDESK);
      if (tds.length) {
        const cx = tds.reduce((a, c) => a + c.x, 0) / tds.length + 0.5, cz = tds.reduce((a, c) => a + c.z, 0) / tds.length + 0.5;
        TG.assets.instanced(g, 'school/teacher_desk', parts.podium, [{ x: cx, z: cz }], (o, c) => { o.position.set(c.x, 0, c.z); });
        inst(g, new THREE.PlaneGeometry(1.0, 2.0), blobMat, [{ x: cx, z: cz }], (o, c) => { o.position.set(c.x, 0.005, c.z); o.rotation.x = -Math.PI / 2; }, false);
        // 出席簿とチョーク箱
        const att = new THREE.Mesh(roundSlab(0.24, 0.32, 0.025, 0.005, 0), MT.plain(0x22386a, 0.5)); att.position.set(cx - 0.05, 0.96, cz - 0.3); att.rotation.y = 0.2; g.add(att);
        const cb = new THREE.Mesh(B(0.12, 0.05, 0.08), MT.plain(0xe8e0c8, 0.7)); cb.position.set(cx - 0.12, 0.985, cz + 0.4); g.add(cb);
      }

      // ---- 黒板（西の壁）：アルミの枠、粉受け、チョーク、黒板消し。上に学級目標、時計 ----
      const bz = (N0 + S0) / 2;
      const board = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.2), new THREE.MeshStandardMaterial({ map: ctx.boardTex(ctx.boardText[r.id] || ''), roughness: 0.88 }));
      board.rotation.y = Math.PI / 2; board.position.set(W0 + 0.035, 1.55, bz); g.add(board);
      const alu = MT.plain(0xb4b8ba, 0.32, 0.85);
      const frame = new THREE.Mesh(merge([
        [B(0.05, 0.05, 4.92), [0.025, 0.625, 0]], [B(0.05, 0.05, 4.92), [0.025, -0.625, 0]],
        [B(0.05, 1.3, 0.05), [0.025, 0, 2.435]], [B(0.05, 1.3, 0.05), [0.025, 0, -2.435]],
        // 粉受け（底板と前のふち）
        [B(0.11, 0.012, 4.8), [0.065, -0.66, 0]], [B(0.012, 0.035, 4.8), [0.12, -0.645, 0]],
      ]), alu);
      frame.position.set(W0, 1.55, bz); frame.castShadow = true; g.add(frame);
      const chalks = [];
      for (let i = 0; i < 7; i++) chalks.push({ z: bz - 1.8 + i * 0.12 + rnd(i + r.x0) * 0.05, c: [0xf8f8f0, 0xf8f8f0, 0xf0d040, 0xe85a5a, 0x5a8ae8][i % 5], r: (rnd(i * 3 + r.x0) - 0.5) * 0.4 });
      inst(g, CY(0.006, 0.006, 0.075, 6), MT.plain(0xffffff, 0.9), chalks, (o, c) => { o.position.set(W0 + 0.07, 0.902, c.z); o.rotation.set(Math.PI / 2, c.r, 0); return c.c; }, false);
      const erasers = [{ z: bz + 0.6 }, { z: bz + 1.4 }];
      inst(g, merge([[B(0.05, 0.025, 0.13), [0, 0.0125, 0]], [B(0.052, 0.012, 0.132), [0, -0.004, 0]]]), MT.plain(0x2a4a8a, 0.8), erasers, (o, c) => { o.position.set(W0 + 0.07, 0.905, c.z); });
      // 学級目標（書道の紙）
      const motto = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.42), new THREE.MeshStandardMaterial({ roughness: 0.9, map: tex(512, 96, (x, w, h) => { x.fillStyle = '#f6f1e2'; x.fillRect(0, 0, w, h); x.fillStyle = '#1a1612'; x.font = '900 52px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('協力・挑戦・思いやり', w / 2, h / 2 + 3); x.strokeStyle = '#b8402a'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, h - 12); }) }));
      motto.rotation.y = Math.PI / 2; motto.position.set(W0 + 0.025, 2.42, bz - 0.7); g.add(motto);
      // 時計：枠と文字盤（14時10分で止まっている）
      const clock = new THREE.Group();
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 24), MT.plain(0x2a2a2c, 0.4, 0.3));
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), new THREE.MeshStandardMaterial({ roughness: 0.35, map: ctx.clockTex }));
      clock.add(rim, face); clock.rotation.y = Math.PI / 2; clock.position.set(W0 + 0.03, 2.42, bz + 1.4); g.add(clock);
      // スピーカーとテレビ（前の窓側の角）
      const spk = new THREE.Mesh(roundSlab(0.3, 0.12, 0.3, 0.02, 0.005), MT.plain(0xe8e4d8, 0.5)); spk.rotation.set(Math.PI / 2, 0, Math.PI / 2); spk.position.set(W0 + 0.08, 2.55, N0 + 0.5); g.add(spk);
      const tv = new THREE.Mesh(merge([[B(0.09, 0.5, 0.86), [0, 0, 0]], [B(0.25, 0.04, 0.04), [-0.12, 0.2, 0]]]), MT.plain(0x121416, 0.3, 0.2));
      tv.position.set(W0 + 0.45, 2.25, N0 + 1.4); tv.rotation.z = -0.1; g.add(tv);
      const tvGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.45), MT.plain(0x050608, 0.08, 0.3, { envMapIntensity: 1.5 }));
      tvGlass.rotation.y = Math.PI / 2; tvGlass.position.set(W0 + 0.497, 2.25, N0 + 1.4); tvGlass.rotation.z = 0; g.add(tvGlass);

      // ---- 後ろ（東の壁）：作り付けの棚とかばん、その上の掲示板 ----
      const cubZ0 = z0 + 2.15, cubZ1 = S0 - 0.15, cubW = 0.42;
      const nCub = Math.floor((cubZ1 - cubZ0) / cubW);
      const cub = new THREE.Mesh(merge([
        [B(0.28, 0.03, nCub * cubW), [0, 0.12, 0]], [B(0.28, 0.03, nCub * cubW), [0, 0.56, 0]], [B(0.28, 0.03, nCub * cubW), [0, 1.0, 0]],
        ...Array.from({ length: nCub + 1 }, (_, i) => [B(0.28, 0.9, 0.02), [0, 0.56, -nCub * cubW / 2 + i * cubW]]),
        [B(0.02, 0.9, nCub * cubW), [0.13, 0.56, 0]],
      ]), MT.surface('oak', 0xc8a070));
      cub.position.set(W1 - 0.15, 0, cubZ0 + nCub * cubW / 2); cub.castShadow = true; cub.receiveShadow = true; g.add(cub);
      const cubBags = [];
      for (let i = 0; i < nCub; i++) for (let row = 0; row < 2; row++) if (rnd(i * 5 + row + r.x0) < 0.7) cubBags.push({ z: cubZ0 + (i + 0.5) * cubW, y: row ? 0.6 : 0.16, c: [0x1e2436, 0x2a2a2a, 0x7a2a2a, 0x2a5a8a, 0xd8d0c0][Math.floor(rnd(i * 7 + row * 3 + r.x0) * 5)], k: rnd(i * 11 + row) });
      inst(g, roundSlab(0.3, 0.2, 0.3, 0.04, 0.012), MT.surface('fabric', 0xffffff, { roughness: 0.8 }), cubBags, (o, b) => { o.position.set(W1 - 0.17, b.y, b.z); o.rotation.set(0, (b.k - 0.5) * 0.4, 0); o.scale.set(0.85 + b.k * 0.2, 1 + b.k * 0.3, 0.85); return b.c; });
      inst(g, new THREE.PlaneGeometry(nCub * cubW + 0.2, 0.6), blobMat, [{}], (o) => { o.position.set(W1 - 0.3, 0.005, cubZ0 + nCub * cubW / 2); o.rotation.set(-Math.PI / 2, 0, Math.PI / 2); }, false);
      const cork = new THREE.Mesh(B(0.03, 1.0, 3.6), MT.surface('cork')); cork.position.set(W1 - 0.03, 1.75, bz); g.add(cork);
      const corkFrame = new THREE.Mesh(merge([[B(0.04, 0.04, 3.7), [0, 0.52, 0]], [B(0.04, 0.04, 3.7), [0, -0.52, 0]], [B(0.04, 1.08, 0.04), [0, 0, 1.83]], [B(0.04, 1.08, 0.04), [0, 0, -1.83]]]), alu);
      corkFrame.position.set(W1 - 0.035, 1.75, bz); g.add(corkFrame);
      for (let k = 0; k < 6; k++) {
        const pm2 = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.56), new THREE.MeshStandardMaterial({ map: ctx.posterTex[(k + r.x0) % ctx.posterTex.length], roughness: 0.85 }));
        pm2.rotation.y = -Math.PI / 2; pm2.rotation.z = (rnd(k + r.x0) - 0.5) * 0.08;
        pm2.position.set(W1 - 0.05, 1.75 + (k % 2 ? -0.18 : 0.2), bz - 1.45 + k * 0.58);
        g.add(pm2);
      }

      // ---- 掃除用具ロッカー（マップのロッカーのマス） ----
      const lockers = M.lockers.filter((l) => l.x >= x0 && l.x <= x1 && l.z >= z0 && l.z <= z1);
      TG.assets.instanced(g, 'school/cleaning_locker', parts.locker(lockerMat), lockers, (o, l) => { o.position.set(l.x + 0.5, 0, l.z + 0.5); o.rotation.y = l.face; });
      inst(g, new THREE.PlaneGeometry(1.0, 1.0), blobMat, lockers, (o, l) => { o.position.set(l.x + 0.5, 0.005, l.z + 0.5); o.rotation.x = -Math.PI / 2; }, false);

      // ---- 窓（北）：奥行きのあるサッシ、2枚のガラス、窓台、カーテン ----
      const wins = ctx.northWindows.filter((w) => w.x > W0 && w.x < W1);
      inst(g, merge([
        [B(1.8, 0.07, 0.12), [0, 0.66, 0]], [B(1.8, 0.07, 0.12), [0, -0.66, 0]], [B(0.07, 1.39, 0.12), [-0.865, 0, 0]], [B(0.07, 1.39, 0.12), [0.865, 0, 0]],
        // 引き違いの2枚：重なる縦框と、前後にずれた横框
        [B(0.05, 1.3, 0.05), [0.02, 0, 0.02]], [B(0.05, 1.3, 0.05), [-0.02, 0, -0.02]],
        [B(0.88, 0.04, 0.04), [-0.44, 0.15, -0.02]], [B(0.88, 0.04, 0.04), [0.44, 0.15, 0.02]],
      ]), alu, wins, (o, w) => { o.position.set(w.x, 1.72, N0 + 0.05); });
      inst(g, merge([[B(0.85, 1.28, 0.006), [-0.44, 0, -0.02]], [B(0.85, 1.28, 0.006), [0.44, 0, 0.02]]]), MT.glass(0xd8eaf4, 0.18), wins, (o, w) => { o.position.set(w.x, 1.72, N0 + 0.05); }, false);
      inst(g, B(1.8, 0.03, 0.16), MT.surface('oak', 0xa07850), wins, (o, w) => { o.position.set(w.x, 1.03, N0 + 0.08); }, 'receive');
      // カーテンレールと、ひだのあるカーテン（窓3つごとにまとめてある）
      const rail = new THREE.Mesh(B(W1 - W0 - 0.2, 0.025, 0.04), alu); rail.position.set((W0 + W1) / 2, 2.48, N0 + 0.16); g.add(rail);
      const curtainGeo = new THREE.PlaneGeometry(0.5, 2.05, 14, 1);
      { const p = curtainGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 44) * 0.035); curtainGeo.computeVertexNormals(); }
      const curt = [];
      wins.forEach((w, i) => { if (i % 2 === 0) curt.push({ x: w.x - 0.95 }); });
      curt.push({ x: W1 - 0.4 });
      inst(g, curtainGeo, MT.surface('fabric', 0xe8dcc0, { side: THREE.DoubleSide, roughness: 0.95 }), curt, (o, c) => { o.position.set(c.x, 1.45, N0 + 0.18); }, 'receive');

      // ---- 蛍光灯：2灯の器具（反射板・管・端のソケット）。光は抑えめに ----
      const fix = [];
      for (let z = z0 + 1; z <= z1; z += 3) for (let x = x0 + 1; x <= x1; x += 3) fix.push({ x: x + 0.5, z: z + 0.5 });
      inst(g, merge([[B(1.28, 0.05, 0.26), [0, 0.025, 0]], [B(1.3, 0.02, 0.02), [0, -0.005, 0.13]], [B(1.3, 0.02, 0.02), [0, -0.005, -0.13]]]), MT.plain(0xe8e8e4, 0.45, 0.2), fix, (o, c) => { o.position.set(c.x, WALL_H - 0.05, c.z); }, false);
      inst(g, merge([[CY(0.014, 0.014, 1.18, 10), [0, 0, 0.055], [0, 0, Math.PI / 2]], [CY(0.014, 0.014, 1.18, 10), [0, 0, -0.055], [0, 0, Math.PI / 2]]]), MT.glow(0xf2f6ff, 1.25), fix, (o, c) => { o.position.set(c.x, WALL_H - 0.075, c.z); }, false);
      inst(g, merge([-1, 1].flatMap((s) => [[B(0.03, 0.04, 0.16), [s * 0.6, 0, 0]]])), MT.plain(0x9a9a96, 0.4, 0.4), fix, (o, c) => { o.position.set(c.x, WALL_H - 0.07, c.z); }, false);

      roomGroups.push({ g, cx: (W0 + W1) / 2, cz: (N0 + S0) / 2 });
    });

    // 遠くの教室は描かない（壁の向こうで見えないため。廊下から戸口越しに見える距離では描く）
    function update(focus) {
      if (!focus) return;
      for (const rg of roomGroups) rg.g.visible = Math.abs(focus.x - rg.cx) < 12 && Math.abs(focus.z - rg.cz) < 11;
    }
    return { rooms: ROOMS, occluders, update };
  };
})();
