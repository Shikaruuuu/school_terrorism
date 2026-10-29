// 〇〇にテロリスト — 学校の3D（マップから校舎を組み立てる）
// 夕方、事件が起きたあとの静かな校舎。南の窓から夕日が差し込み、廊下は薄暗い。
// 形はマップのマスに合わせたまま、質感（PBR）・小物・照明で「その場所にいる感じ」を出す。
window.TG = window.TG || {};
(function () {
  const MT = TG.mat;
  const WALL_H = 2.8;

  const { merge, inst, cv, B, CY } = MT;

  const FONT = '"Zen Kaku Gothic New", "Hiragino Sans", sans-serif';
  function boardTex(text) {
    return cv(1024, 256, (x, w, h) => {
      x.fillStyle = '#22402f'; x.fillRect(0, 0, w, h);
      // 消し跡
      for (let i = 0; i < 30; i++) { x.fillStyle = 'rgba(255,255,255,' + (0.02 + Math.random() * 0.04) + ')'; x.fillRect(Math.random() * w, Math.random() * h, 80 + Math.random() * 200, 10 + Math.random() * 30); }
      x.fillStyle = 'rgba(245,245,235,.88)';
      x.font = '700 64px ' + FONT; x.textBaseline = 'middle';
      x.fillText(text, 50, 100);
      x.font = '700 34px ' + FONT; x.fillStyle = 'rgba(255,220,120,.75)';
      x.fillText('日直：' + ['田中', '佐藤', '高橋', '山本'][Math.floor(Math.random() * 4)], w - 230, 210);
    });
  }
  const POSTERS = [['体育祭', '#e8503a', '#fff3e0'], ['合唱コンクール', '#3a6ee8', '#eef3ff'], ['読書週間', '#2f9a5a', '#f0fff4'], ['防災訓練', '#e0a020', '#fffbe8'],
    ['いじめゼロ宣言', '#d0457a', '#fff0f6'], ['期末テスト', '#5a4ad0', '#f2f0ff'], ['給食だより', '#e07a2a', '#fff6ec'], ['部員募集', '#1f8a9a', '#ecfdff']];
  const posterTex = POSTERS.map(([t, c, bg], i) => cv(256, 360, (x, w, h) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    x.fillStyle = c; x.fillRect(0, 0, w, 90);
    x.fillStyle = '#fff'; x.font = '900 ' + (t.length > 5 ? 30 : 44) + 'px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(t, w / 2, 48);
    x.fillStyle = c; x.globalAlpha = 0.25;
    for (let k = 0; k < 6; k++) x.fillRect(24, 120 + k * 34, w - 48 - (k % 2) * 60, 14);
    x.globalAlpha = 1;
    x.beginPath(); x.arc(w / 2 + (i % 3 - 1) * 40, 300, 34, 0, Math.PI * 2); x.fill();
  }));
  const exitTex = cv(256, 128, (x, w, h) => {
    x.fillStyle = '#0f9d58'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff'; x.fillRect(150, 18, 80, 92);
    x.fillStyle = '#0f9d58'; x.fillRect(160, 28, 60, 82);
    // 走る人
    x.fillStyle = '#fff';
    x.beginPath(); x.arc(78, 30, 13, 0, Math.PI * 2); x.fill();
    x.lineWidth = 12; x.strokeStyle = '#fff'; x.lineCap = 'round';
    x.beginPath(); x.moveTo(78, 46); x.lineTo(98, 80); x.lineTo(70, 110); x.moveTo(98, 80); x.lineTo(126, 100); x.moveTo(80, 55); x.lineTo(52, 72); x.moveTo(84, 58); x.lineTo(120, 52); x.stroke();
  });
  const clockTex = cv(128, 128, (x) => {
    x.fillStyle = '#f6f4ee'; x.beginPath(); x.arc(64, 64, 60, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#222'; x.lineWidth = 6; x.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.lineWidth = 3; x.beginPath(); x.moveTo(64 + Math.sin(a) * 46, 64 - Math.cos(a) * 46); x.lineTo(64 + Math.sin(a) * 54, 64 - Math.cos(a) * 54); x.stroke(); }
    // 5時間目、14時10分で止まった時計
    x.lineWidth = 5; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + Math.sin(2.15) * 30, 64 - Math.cos(2.15) * 30); x.stroke();
    x.lineWidth = 3; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + Math.sin(1.05) * 44, 64 - Math.cos(1.05) * 44); x.stroke();
  });
  const cubbyTex = cv(256, 256, (x, w, h) => {
    x.fillStyle = '#c9c2b0'; x.fillRect(0, 0, w, h);
    const cs = ['#f4f4f4', '#2b3a55', '#e7e2d6', '#8a2b2b', '#e8e8e8', '#333'];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      x.fillStyle = '#2a2722'; x.fillRect(c * 64 + 5, r * 64 + 5, 54, 54);
      if (Math.random() < 0.7) { x.fillStyle = cs[(r * 4 + c) % cs.length]; x.fillRect(c * 64 + 10, r * 64 + 38, 44, 16); }
    }
  });
  const binderTex = cv(256, 256, (x, w, h) => {
    x.fillStyle = '#5a4630'; x.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) {
      let px = 6;
      while (px < w - 10) {
        const bw = 10 + Math.random() * 16;
        x.fillStyle = ['#2e4a7a', '#7a2e2e', '#2e6a4a', '#d8d2c0', '#c0902a', '#444'][Math.floor(Math.random() * 6)];
        x.fillRect(px, r * 64 + 10 + Math.random() * 8, bw - 2, 50);
        px += bw;
      }
      x.fillStyle = '#3a2c1c'; x.fillRect(0, r * 64 + 58, w, 6);
    }
  });
  const rackTex = cv(128, 256, (x, w, h) => {
    x.fillStyle = '#1b1d22'; x.fillRect(0, 0, w, h);
    for (let r = 0; r < 10; r++) {
      x.fillStyle = '#2b2f36'; x.fillRect(6, r * 25 + 4, w - 12, 18);
      for (let k = 0; k < 5; k++) { x.fillStyle = Math.random() < 0.5 ? '#3cff8a' : Math.random() < 0.5 ? '#ffb020' : '#ff3030'; x.fillRect(12 + k * 8, r * 25 + 10, 4, 4); }
    }
  });
  const plateTex = (text) => cv(256, 72, (x, w, h) => {
    x.fillStyle = '#f4efe1'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#3b3326'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6);
    x.fillStyle = '#1f1a12'; x.font = '900 38px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, w / 2, h / 2 + 2);
  });
  const onAirTex = cv(256, 96, (x, w, h) => {
    x.fillStyle = '#300'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#ff2a20'; x.font = '900 52px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('ON AIR', w / 2, h / 2 + 2);
  });
  // 夕焼けの窓（南）と、宵の空の窓（北）
  const winSouth = cv(64, 128, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffd59a'); g.addColorStop(0.55, '#ff9a4a'); g.addColorStop(1, '#ff7a36');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  const winNorth = cv(64, 128, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#5a6aa8'); g.addColorStop(1, '#c08aa0');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });

  function build(group) {
    const M = TG.map;
    const { T, F } = M;
    const roomOf = (x, z) => M.roomAt(x + 0.5, z + 0.5).id;
    const lists = {};
    const push = (k, v) => { (lists[k] = lists[k] || []).push(v); };
    for (let z = 0; z < M.H; z++) for (let x = 0; x < M.W; x++) {
      const t = M.get(x, z);
      const c = { x, z, t, f: M.floor[z * M.W + x], room: roomOf(x, z) };
      if (t !== T.WALL) push('floor' + c.f, c);
      if (t === T.WALL) push(x === 4 || x === 59 || z === 3 || z === 27 ? 'wallOut' : (c.x >= 5 && c.x <= 14 && c.z >= 31) ? 'wallShed' : 'wall', c);
      else if (t === T.DESK) push('desk', c);
      else if (t === T.TDESK) push('tdesk', c);
      else if (t === T.SHELF) push('shelf', c);
      else if (t === T.PIANO) push('piano', c);
      else if (t === T.BOX) push('box', c);
      else if (t === T.BIKE) push('bike', c);
      else if (t === T.BED) push('bed', c);
      else if (t === T.TREE) push('tree', c);
      else if (t === T.FENCE) push('fence', c);
      else if (t === T.GATE) push('gate', c);
    }
    const add = (m) => { group.add(m); return m; };
    const isWall = (x, z) => M.get(x, z) === T.WALL;

    // ===================== 地面 =====================
    const grass = MT.surface('grass', 0xb8c4a0);
    const g0 = add(new THREE.Mesh(new THREE.PlaneGeometry(320, 320), grass));
    g0.rotation.x = -Math.PI / 2; g0.position.set(M.W / 2, -0.06, M.H / 2); g0.receiveShadow = true;
    const asph = MT.surface('asphalt');
    [[M.W / 2, M.H + 4.5, 220, 7], [M.W + 4.5, M.H / 2, 7, 220]].forEach(([x, z, w, d]) => {
      const r = add(new THREE.Mesh(new THREE.PlaneGeometry(w, d), asph));
      r.rotation.x = -Math.PI / 2; r.position.set(x, -0.05, z); r.receiveShadow = true;
    });
    // 道路の白線
    const lineM = MT.plain(0xe8e4d8, 0.6);
    inst(group, B(2, 0.01, 0.14), lineM, Array.from({ length: 40 }, (_, i) => i), (o, i) => { o.position.set(-20 + i * 4, -0.035, M.H + 4.5); }, 'receive');

    // ===================== 床 =====================
    const FLOOR = { [F.GRASS]: MT.surface('grass'), [F.CORR]: MT.surface('lino'), [F.WOOD]: MT.surface('wood'), [F.TILE]: MT.surface('tile'), [F.DIRT]: MT.surface('dirt'), [F.MAT]: MT.surface('mat') };
    const floorGeo = B(1, 0.1, 1);
    Object.keys(FLOOR).forEach((f) => inst(group, floorGeo, FLOOR[f], lists['floor' + f], (o, c) => { o.position.set(c.x + 0.5, -0.05, c.z + 0.5); }, 'receive'));
    // 校庭のトラックの白線
    const track = [];
    for (let a = 0; a < 64; a++) track.push(a);
    inst(group, B(0.9, 0.012, 0.08), MT.plain(0xf2efe6, 0.8), track, (o, i) => {
      const a = (i / 64) * Math.PI * 2;
      o.position.set(38 + Math.cos(a) * 15, 0.006, 36.5 + Math.sin(a) * 5.5);
      o.rotation.y = -a + Math.PI / 2;
    }, 'receive');

    // ===================== 壁 =====================
    // 中の壁はしっくい。南の外壁は影を落とさない（窓から夕日が入る）
    const plaster = MT.surface('plaster', 0xf1ead8);
    const outer = MT.surface('concrete', 0xd8d2c4);
    const wallGeo = B(1, WALL_H, 1);
    inst(group, wallGeo, plaster, lists.wall, (o, c) => { o.position.set(c.x + 0.5, WALL_H / 2, c.z + 0.5); });
    const southOut = (lists.wallOut || []).filter((c) => c.z === 27);
    inst(group, wallGeo, outer, (lists.wallOut || []).filter((c) => c.z !== 27), (o, c) => { o.position.set(c.x + 0.5, WALL_H / 2, c.z + 0.5); });
    inst(group, wallGeo, outer, southOut, (o, c) => { o.position.set(c.x + 0.5, WALL_H / 2, c.z + 0.5); }, 'receive');
    inst(group, wallGeo, MT.surface('concrete', 0xb8b0a0), lists.wallShed, (o, c) => { o.position.set(c.x + 0.5, WALL_H / 2, c.z + 0.5); });
    // 腰壁（少し厚く、落ち着いた緑灰色）・幅木・天端
    const allWalls = (lists.wall || []).concat(lists.wallOut || []);
    inst(group, B(1.02, 0.95, 1.02), MT.surface('plaster', 0x8a9a8a, { roughness: 0.6 }), allWalls, (o, c) => { o.position.set(c.x + 0.5, 0.475, c.z + 0.5); }, 'receive');
    inst(group, B(1.04, 0.1, 1.04), MT.plain(0x3a3630, 0.5), allWalls, (o, c) => { o.position.set(c.x + 0.5, 0.05, c.z + 0.5); }, 'receive');
    inst(group, B(1.03, 0.04, 1.03), MT.plain(0x6a6458, 0.6), allWalls, (o, c) => { o.position.set(c.x + 0.5, 0.95, c.z + 0.5); }, 'receive');
    // 屋上のへり（外から見たときに校舎らしく）
    inst(group, B(1.06, 0.3, 1.06), MT.surface('concrete', 0xc8c2b4), (lists.wallOut || []), (o, c) => { o.position.set(c.x + 0.5, WALL_H + 0.15, c.z + 0.5); });

    // 戸口：壁の切れ目の上に、かもい（上の壁）と枠をつける。1〜3マスの切れ目だけ
    const lintels = [], jambs = [];
    const scanLine = (horiz, fixed, from, to) => {
      let run = [];
      const flush = () => {
        if (run.length && run.length <= 3) {
          run.forEach((p) => lintels.push({ x: p[0], z: p[1], horiz }));
          const a = run[0], b = run[run.length - 1];
          jambs.push({ x: horiz ? a[0] : a[0] + 0.5, z: horiz ? a[1] + 0.5 : a[1], horiz }, { x: horiz ? b[0] + 1 : b[0] + 0.5, z: horiz ? b[1] + 0.5 : b[1] + 1, horiz });
        }
        run = [];
      };
      for (let i = from; i <= to; i++) {
        const x = horiz ? i : fixed, z = horiz ? fixed : i;
        if (!isWall(x, z) && (horiz ? isWall(x - 1, z) || run.length : isWall(x, z - 1) || run.length) && !isWall(horiz ? x : x - 1, horiz ? z - 1 : z) && !isWall(horiz ? x : x + 1, horiz ? z + 1 : z)) run.push([x, z]);
        else flush();
        if (isWall(x, z)) flush();
      }
      flush();
    };
    [3, 13, 17, 27].forEach((z) => scanLine(true, z, 4, 59));
    [4, 13, 15, 22, 26, 31, 37, 40, 48, 50, 59].forEach((x) => scanLine(false, x, 3, 27));
    scanLine(true, 31, 5, 14); scanLine(true, 39, 5, 14); scanLine(false, 14, 31, 39); scanLine(false, 5, 31, 39);
    inst(group, B(1, WALL_H - 2.1, 1), plaster, lintels, (o, c) => { o.position.set(c.x + 0.5, 2.1 + (WALL_H - 2.1) / 2, c.z + 0.5); });
    inst(group, B(1.02, 0.08, 1.06), MT.plain(0x5a4630, 0.5), lintels, (o, c) => { o.position.set(c.x + 0.5, 2.08, c.z + 0.5); });
    inst(group, B(0.08, 2.1, 1.06), MT.plain(0x5a4630, 0.5), jambs, (o, c) => { o.position.set(c.x, 1.05, c.z); if (c.horiz) o.rotation.y = 0; else o.rotation.y = Math.PI / 2; });

    // 教室の引き戸（開けたまま、戸袋側の壁の前に寄せてある）
    const doors = [];
    [5, 16, 27, 38, 49].forEach((x0) => { doors.push({ x: x0 + 3.5, z: 14.04 }, { x: x0 + 6.5, z: 14.04 }); });
    [7, 16, 35, 43, 53].forEach((x) => doors.push({ x: x + 2.5, z: 16.96 }));
    const doorWood = MT.surface('deskwood', 0xb08a5a, { roughness: 0.55 });
    inst(group, merge([[B(0.9, 1.95, 0.05), [0, 0.98, 0]]]), doorWood, doors, (o, c) => { o.position.set(c.x, 0, c.z); });
    inst(group, B(0.6, 0.55, 0.06), MT.glass(0xcfe0ea, 0.35), doors, (o, c) => { o.position.set(c.x, 1.45, c.z); }, false);

    // ===================== 窓 =====================
    // 南の窓：夕焼けの光る面と、窓枠・カーテン。北の窓：宵の空
    const winS = [], winN = [], winOut = [];
    for (let x = 5; x <= 58; x += 2) {
      if (x >= 24 && x <= 30) continue; // 昇降口
      if ([13, 22, 31, 40, 50].some((w) => Math.abs(w + 0.5 - (x + 1)) < 1)) continue;
      winS.push({ x: x + 1, z: 26.985, fz: 26.965 });
      winOut.push({ x: x + 1, z: 28.015, ry: 0, fz: 28.035 });
    }
    for (let x = 6; x <= 58; x += 2) {
      if ([15, 26, 37, 48].some((w) => Math.abs(w + 0.5 - (x + 1)) < 1)) continue;
      winN.push({ x: x + 1, z: 4.015, fz: 4.035 });
      winOut.push({ x: x + 1, z: 2.985, ry: Math.PI, fz: 2.965 });
    }
    const wsMat = new THREE.MeshBasicMaterial({ map: winSouth, toneMapped: false, color: new THREE.Color(2.2, 2.2, 2.2), fog: false });
    const wnMat = new THREE.MeshBasicMaterial({ map: winNorth, toneMapped: false, color: new THREE.Color(1.1, 1.1, 1.1), fog: false });
    const winGeo = new THREE.PlaneGeometry(1.7, 1.25);
    inst(group, winGeo, wsMat, winS, (o, c) => { o.position.set(c.x, 1.72, c.z); o.rotation.y = Math.PI; }, false);
    inst(group, winGeo, wnMat, winN, (o, c) => { o.position.set(c.x, 1.72, c.z); }, false);
    // 外から見た窓：中の蛍光灯が透ける
    inst(group, winGeo, new THREE.MeshStandardMaterial({ color: 0x2a3440, emissive: 0xffe0b0, emissiveIntensity: 0.35, roughness: 0.08, metalness: 0.4, envMapIntensity: 1.5 }), winOut, (o, c) => { o.position.set(c.x, 1.72, c.z); o.rotation.y = c.ry; }, false);
    // 窓枠（縦の桟と横の桟）
    const frameGeo = merge([[B(1.78, 0.06, 0.06), [0, 0.62, 0]], [B(1.78, 0.06, 0.06), [0, -0.62, 0]], [B(0.06, 1.28, 0.06), [-0.86, 0, 0]], [B(0.06, 1.28, 0.06), [0.86, 0, 0]], [B(0.05, 1.28, 0.05), [0, 0, 0]], [B(1.78, 0.04, 0.04), [0, 0.15, 0]]]);
    const alu = MT.plain(0x9aa2a8, 0.35, 0.8);
    inst(group, frameGeo, alu, winS.concat(winN).concat(winOut), (o, c) => { o.position.set(c.x, 1.72, c.fz); }, false);
    // カーテン（南の窓の端に寄せてある）
    const curtain = MT.surface('fabric', 0xd9c69a, { side: THREE.DoubleSide });
    inst(group, B(0.32, 2.05, 0.05), curtain, winS.filter((_, i) => i % 3 === 0), (o, c) => { o.position.set(c.x - 0.95, 1.5, c.z - 0.08); }, 'receive');

    // 差し込む夕日の光の筋（加算で光る板。窓から斜め下へ）
    const shaftMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { color: { value: new THREE.Color(1.0, 0.62, 0.32) }, time: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 color; uniform float time; varying vec2 vUv; void main(){ float a = smoothstep(0.0,0.15,vUv.x)*smoothstep(1.0,0.85,vUv.x)*smoothstep(1.0,0.0,vUv.y)*smoothstep(0.0,0.08,vUv.y); a *= 0.17 + 0.04*sin(time*0.7 + vUv.x*6.0); gl_FragColor = vec4(color*a, 1.0); }',
    });
    const shaftGeo = new THREE.PlaneGeometry(1.5, 5);
    shaftGeo.translate(0, -2.5, 0);
    const shafts = new THREE.InstancedMesh(shaftGeo, shaftMat, winS.length);
    const so = new THREE.Object3D();
    winS.forEach((c, i) => {
      so.position.set(c.x, 2.2, c.z - 0.05);
      so.rotation.set(0.95, 0.38, 0, 'YXZ');
      so.updateMatrix();
      shafts.setMatrixAt(i, so.matrix);
    });
    shafts.frustumCulled = false;
    add(shafts);

    // 漂うほこり（光の筋のあたり）
    const dustN = MT.isTouch ? 160 : 400;
    const dp = new Float32Array(dustN * 3);
    for (let i = 0; i < dustN; i++) { const w = winS[i % winS.length]; dp[i * 3] = w.x + (Math.random() - 0.5) * 2.4; dp[i * 3 + 1] = 0.3 + Math.random() * 2.2; dp[i * 3 + 2] = w.z - 0.3 - Math.random() * 4; }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    const dust = add(new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffc890, size: 0.025, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })));

    // ===================== 天井と照明 =====================
    const ceilMat = MT.surface('ceil', 0xffffff);
    const ceiling = (x0, z0, x1, z1) => {
      const m = add(new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), ceilMat));
      m.rotation.x = Math.PI / 2;
      m.position.set((x0 + x1) / 2, WALL_H, (z0 + z1) / 2);
    };
    ceiling(4, 3, 60, 28);
    ceiling(5, 31, 15, 40);
    // 蛍光灯：器具の箱＋光る管。廊下は半分消えていて、いくつかはちらつく
    const tubes = [], dark = [], flick = [];
    const sources = [];
    M.rooms.forEach((r) => {
      if (r.id === 'yard' || r.id === 'backyard') return;
      const corr = r.id === 'corr';
      const stepX = corr ? 4 : 3, stepZ = corr ? 9 : 3;
      for (let z = r.z0 + (corr ? 1 : 1); z <= r.z1; z += stepZ) for (let x = r.x0 + 1; x <= r.x1; x += stepX) {
        const k = (x * 7 + z * 3) % 11;
        const c = { x: x + 0.5, z: z + 0.5 + (corr ? 0 : 0) };
        if (corr && k < 4) { dark.push(c); continue; }
        if (k === 5 && corr) flick.push(c); else tubes.push(c);
        sources.push({ x: c.x, y: WALL_H - 0.3, z: c.z, color: r.id === 'shed' ? 0xffc890 : 0xe8eeff, intensity: corr ? 2.6 : 3.2, distance: 6.5, flicker: k === 5 && corr ? () => (Math.sin(performance.now() * 0.031) > 0.6 || Math.random() < 0.05 ? 0.15 : 1) : null });
      }
    });
    const housing = MT.plain(0xd8d8d4, 0.5, 0.3);
    const fixtureGeo = B(1.3, 0.07, 0.24);
    const tubeGeo = B(1.2, 0.025, 0.12);
    const allFix = tubes.concat(dark, flick);
    inst(group, fixtureGeo, housing, allFix, (o, c) => { o.position.set(c.x, WALL_H - 0.04, c.z); }, false);
    inst(group, tubeGeo, MT.glow(0xeef3ff, 2.6), tubes, (o, c) => { o.position.set(c.x, WALL_H - 0.085, c.z); }, false);
    inst(group, tubeGeo, MT.plain(0x6a6e72, 0.4), dark, (o, c) => { o.position.set(c.x, WALL_H - 0.085, c.z); }, false);
    const flickMat = MT.glow(0xeef3ff, 2.6).clone();
    const flickMesh = inst(group, tubeGeo, flickMat, flick, (o, c) => { o.position.set(c.x, WALL_H - 0.085, c.z); }, false);

    // ===================== 教室 =====================
    // 机と椅子：天板（合板）＋スチールの脚。事件のあとなので、少し乱れて、倒れた椅子もある
    const steel = MT.plain(0x8a9096, 0.4, 0.75);
    const deskTopGeo = B(0.64, 0.03, 0.46);
    const deskFrameGeo = merge([
      [B(0.03, 0.7, 0.03), [-0.29, 0.35, -0.2]], [B(0.03, 0.7, 0.03), [0.29, 0.35, -0.2]], [B(0.03, 0.7, 0.03), [-0.29, 0.35, 0.2]], [B(0.03, 0.7, 0.03), [0.29, 0.35, 0.2]],
      [B(0.58, 0.1, 0.38), [0, 0.62, 0]], [B(0.58, 0.02, 0.02), [0, 0.12, 0.2]],
    ]);
    const chairSeatGeo = merge([[B(0.38, 0.025, 0.38), [0, 0.43, 0]], [B(0.38, 0.26, 0.02), [0, 0.7, 0.18]]]);
    const chairFrameGeo = merge([
      [B(0.025, 0.43, 0.025), [-0.17, 0.215, -0.16]], [B(0.025, 0.43, 0.025), [0.17, 0.215, -0.16]], [B(0.025, 0.85, 0.025), [-0.17, 0.425, 0.17]], [B(0.025, 0.85, 0.025), [0.17, 0.425, 0.17]],
    ]);
    const rnd = (s) => { const v = Math.sin(s * 12.9898) * 43758.5453; return v - Math.floor(v); };
    const desks = (lists.desk || []).filter((c) => c.room !== 'music');
    const deskWood = MT.surface('deskwood');
    const deskPlace = (o, c) => { o.position.set(c.x + 0.5 + (rnd(c.x + c.z * 3) - 0.5) * 0.12, 0, c.z + 0.5 + (rnd(c.z + c.x) - 0.5) * 0.1); o.rotation.y = Math.PI / 2 + (rnd(c.x * 5 + c.z) - 0.5) * 0.25; };
    inst(group, deskTopGeo, deskWood, desks, (o, c) => { deskPlace(o, c); o.position.y = 0.72; });
    inst(group, deskFrameGeo, steel, desks, deskPlace);
    // 椅子は机の東側（黒板は西）。いくつかは倒れている
    const chairs = desks.map((c) => ({ ...c, fallen: rnd(c.x * 11 + c.z * 7) < 0.18 }));
    const chairPlace = (o, c) => {
      const r = rnd(c.x * 3 + c.z * 13);
      o.position.set(c.x + 0.5 + 0.42 + r * 0.15, 0, c.z + 0.5 + (r - 0.5) * 0.2);
      o.rotation.y = -Math.PI / 2 + (r - 0.5) * 0.6;
      if (c.fallen) { o.rotation.set(0, r * 6, 0); o.rotateX(-Math.PI / 2); o.position.y = 0.2; o.position.x += 0.25; }
    };
    inst(group, chairSeatGeo, deskWood, chairs, chairPlace);
    inst(group, chairFrameGeo, steel, chairs, chairPlace);
    // 音楽室の机は譜面台に
    inst(group, merge([[B(0.02, 1.1, 0.02), [0, 0.55, 0]], [B(0.42, 0.3, 0.02), [0, 1.15, 0.03], [-0.3, 0, 0]], [B(0.3, 0.02, 0.3), [0, 0.01, 0]]]), MT.plain(0x2a2a2c, 0.35, 0.7), (lists.desk || []).filter((c) => c.room === 'music'), (o, c) => { o.position.set(c.x + 0.5, 0, c.z + 0.5); o.rotation.y = -Math.PI / 2; });

    // 教卓・作業台（部屋ごとに形を変える）
    const td = lists.tdesk || [];
    const classTd = td.filter((c) => ['1a', '2a', '2b', '3a', 'janitor', 'infirm'].includes(c.room));
    inst(group, B(0.98, 0.04, 0.98), MT.surface('deskwood', 0xa07040), classTd, (o, c) => { o.position.set(c.x + 0.5, 0.86, c.z + 0.5); });
    inst(group, B(0.9, 0.84, 0.9), MT.surface('deskwood', 0x7a5530), classTd, (o, c) => { o.position.set(c.x + 0.5, 0.42, c.z + 0.5); });
    // 職員室：机の島、パソコンの画面、書類の山
    const staffTd = td.filter((c) => c.room === 'staff');
    inst(group, B(0.98, 0.04, 0.98), MT.surface('deskwood', 0xd8d0c0), staffTd, (o, c) => { o.position.set(c.x + 0.5, 0.74, c.z + 0.5); });
    inst(group, B(0.9, 0.7, 0.9), MT.plain(0x8a9098, 0.45, 0.6), staffTd, (o, c) => { o.position.set(c.x + 0.5, 0.36, c.z + 0.5); });
    inst(group, merge([[B(0.42, 0.28, 0.03), [0, 0.98, 0]], [B(0.05, 0.2, 0.05), [0, 0.82, -0.02]]]), MT.plain(0x1a1c20, 0.4), staffTd, (o, c) => { o.position.set(c.x + 0.5 + (c.x % 2 ? 0.2 : -0.2), 0, c.z + 0.5); o.rotation.y = c.x % 2 ? -Math.PI / 2 : Math.PI / 2; });
    inst(group, B(0.38, 0.24, 0.005), MT.glow(0x9ac8ff, 1.1), staffTd, (o, c) => { o.position.set(c.x + 0.5 + (c.x % 2 ? 0.18 : -0.18), 0.98, c.z + 0.5); o.rotation.y = c.x % 2 ? -Math.PI / 2 : Math.PI / 2; }, false);
    inst(group, B(0.24, 0.12, 0.3), MT.plain(0xf0eee6, 0.9), staffTd.filter((c) => (c.x + c.z) % 2), (o, c) => { o.position.set(c.x + 0.4, 0.82, c.z + 0.4); o.rotation.y = c.z; });
    // 理科室：黒い実験台と流し、ビーカー
    const labTd = td.filter((c) => c.room === 'lab');
    inst(group, B(0.98, 0.05, 0.98), MT.plain(0x15171a, 0.25), labTd, (o, c) => { o.position.set(c.x + 0.5, 0.86, c.z + 0.5); });
    inst(group, B(0.92, 0.84, 0.92), MT.plain(0xe0ddd4, 0.6), labTd, (o, c) => { o.position.set(c.x + 0.5, 0.42, c.z + 0.5); });
    const beakers = [];
    labTd.forEach((c, i) => { for (let k = 0; k < 3; k++) beakers.push({ x: c.x + 0.25 + k * 0.22, z: c.z + 0.3 + (i % 2) * 0.4, h: 0.12 + ((i + k) % 3) * 0.05 }); });
    inst(group, CY(0.04, 0.04, 1, 12), MT.glass(0xd8f0ff, 0.35), beakers, (o, c) => { o.position.set(c.x, 0.89 + c.h / 2, c.z); o.scale.set(1, c.h, 1); }, false);
    inst(group, CY(0.036, 0.036, 1, 12), MT.plain(0x5ad0a0, 0.2, 0, { transparent: true, opacity: 0.7 }), beakers.filter((_, i) => i % 2), (o, c) => { o.position.set(c.x, 0.89 + c.h * 0.25, c.z); o.scale.set(1, c.h * 0.5, 1); }, false);
    // 放送室：ミキサー卓（光るつまみ）、モニター、ON AIR のランプ
    const bcTd = td.filter((c) => c.room === 'bcast');
    inst(group, B(0.98, 0.1, 0.98), MT.plain(0x22252b, 0.35, 0.5), bcTd, (o, c) => { o.position.set(c.x + 0.5, 0.82, c.z + 0.5); o.rotation.x = -0.12; });
    inst(group, B(0.92, 0.78, 0.92), MT.plain(0x2b2e34, 0.5, 0.4), bcTd, (o, c) => { o.position.set(c.x + 0.5, 0.39, c.z + 0.5); });
    const knobs = [];
    bcTd.forEach((c) => { for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) knobs.push({ x: c.x + 0.15 + i * 0.14, z: c.z + 0.25 + j * 0.2, k: (i + j + c.x) % 4 }); });
    inst(group, B(0.04, 0.02, 0.04), MT.glow(0x40ff90, 2), knobs.filter((k) => k.k === 0), (o, c) => { o.position.set(c.x, 0.88, c.z); }, false);
    inst(group, B(0.04, 0.02, 0.04), MT.glow(0xffa020, 2), knobs.filter((k) => k.k === 1), (o, c) => { o.position.set(c.x, 0.88, c.z); }, false);
    inst(group, CY(0.018, 0.018, 0.05, 8), MT.plain(0x9a9a9a, 0.3, 0.8), knobs.filter((k) => k.k > 1), (o, c) => { o.position.set(c.x, 0.89, c.z); }, false);
    const onAir = new THREE.MeshBasicMaterial({ map: onAirTex, color: new THREE.Color(2.4, 2.4, 2.4), toneMapped: false });
    [[35.5, 2.35, 17.03, 0], [35.5, 2.35, 25.97, Math.PI]].forEach(([x, y, z, r]) => { const m = add(new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.28), onAir)); m.position.set(x, y, z); m.rotation.y = r; });
    // 吸音パネル（放送室の壁）
    inst(group, B(0.06, 1.4, 0.9), MT.surface('fabric', 0x3a3e48), [[32.06, 19], [32.06, 21], [32.06, 23], [38.94, 23]].map(([x, z]) => ({ x, z })), (o, c) => { o.position.set(c.x, 1.6, c.z + 0.5); }, 'receive');

    // 黒板（枠・粉受け・文字）と時計・掲示物
    const boards = { '1a': '1年A組　英語　be動詞', '2a': '5時間目　数学　x²−5x+6=0', '2b': '2年B組　国語　走れメロス', '3a': '3年A組　理科　電流と磁界', music: '♪ 合唱コンクール練習' };
    const boardFrame = MT.plain(0x6a4a2a, 0.5);
    M.rooms.forEach((r) => {
      if (!boards[r.id]) return;
      const bm = add(new THREE.Mesh(new THREE.PlaneGeometry(5, 1.25), new THREE.MeshStandardMaterial({ map: boardTex(boards[r.id]), roughness: 0.9 })));
      bm.rotation.y = Math.PI / 2; bm.position.set(r.x0 + 0.03, 1.5, 8.5);
      const fr = add(new THREE.Mesh(merge([[B(0.05, 0.08, 5.15), [0, 0.66, 0]], [B(0.05, 0.08, 5.15), [0, -0.66, 0]], [B(0.05, 1.4, 0.08), [0, 0, 2.55]], [B(0.05, 1.4, 0.08), [0, 0, -2.55]], [B(0.14, 0.04, 5), [0.07, -0.7, 0]]]), boardFrame));
      fr.position.set(r.x0 + 0.02, 1.5, 8.5);
      const ck = add(new THREE.Mesh(new THREE.CircleGeometry(0.17, 24), new THREE.MeshStandardMaterial({ map: clockTex, roughness: 0.4 })));
      ck.rotation.y = Math.PI / 2; ck.position.set(r.x0 + 0.03, 2.45, 8.5);
      // 後ろの掲示板
      const pb = add(new THREE.Mesh(B(0.04, 1.0, 3.2), MT.plain(0x9a7a50, 0.9)));
      pb.position.set(r.x1 + 0.97, 1.6, 8.5);
      for (let k = 0; k < 4; k++) {
        const pm = add(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.6), new THREE.MeshStandardMaterial({ map: posterTex[(k + r.x0) % posterTex.length], roughness: 0.85 })));
        pm.rotation.y = -Math.PI / 2; pm.position.set(r.x1 + 0.94, 1.6 + (k % 2 ? -0.05 : 0.05), 7.35 + k * 0.75);
      }
    });

    // ロッカー（掃除用具・保健室・用務員室）：塗装した金属、通気口、取っ手
    const lockerMat = MT.surface('locker', 0xffffff).clone();
    MT.worldUV(lockerMat, 0.5);
    const lockerCells = M.lockers;
    inst(group, B(0.86, 2.0, 0.92), lockerMat, lockerCells, (o, l) => { o.position.set(l.x + 0.52, 1.0, l.z + 0.5); });
    inst(group, B(0.02, 0.22, 0.04), MT.plain(0x2a2e34, 0.3, 0.8), lockerCells, (o, l) => { o.position.set(l.x + 0.52 + Math.sin(l.face) * 0.45, 1.1, l.z + 0.5 + Math.cos(l.face) * 0.45 + 0.25); });

    // 棚：部屋ごとに中身を変える（下駄箱・書類棚・薬品棚・機材ラック・道具棚）
    const shelves = lists.shelf || [];
    const shelfMats = [];
    const shelfBy = (room, mat, h) => {
      const L = shelves.filter((c) => room.includes(c.room));
      const m = mat.clone();
      shelfMats.push(m);
      inst(group, B(0.96, h, 0.96), m, L, (o, c) => { o.position.set(c.x + 0.5, h / 2, c.z + 0.5); });
    };
    shelfBy(['entr'], new THREE.MeshStandardMaterial({ map: cubbyTex, roughness: 0.75 }), 1.75);
    shelfBy(['staff'], new THREE.MeshStandardMaterial({ map: binderTex, roughness: 0.7 }), 1.9);
    shelfBy(['bcast'], new THREE.MeshStandardMaterial({ map: rackTex, roughness: 0.4, metalness: 0.4, emissive: 0xffffff, emissiveMap: rackTex, emissiveIntensity: 0.6 }), 1.9);
    shelfBy(['infirm', 'lab'], new THREE.MeshStandardMaterial({ color: 0xe8ece8, roughness: 0.3, metalness: 0.1 }), 1.9);
    shelfBy(['janitor', 'corr', 'yard', 'shed', 'out'], new THREE.MeshStandardMaterial({ map: binderTex, color: 0x9a9a9a, roughness: 0.6, metalness: 0.5 }), 1.9);
    // 薬品棚のガラス戸
    inst(group, B(0.9, 1.7, 0.02), MT.glass(0xe0f0ff, 0.3), shelves.filter((c) => c.room === 'infirm' || c.room === 'lab'), (o, c) => { o.position.set(c.x + 0.5, 0.95, c.z + 0.01); }, false);

    // グランドピアノ（音楽室）：黒い鏡面、少し開けたふた、譜面
    const piano = lists.piano || [];
    if (piano.length) {
      const px = Math.min(...piano.map((c) => c.x)), pz = Math.min(...piano.map((c) => c.z));
      const lacquer = MT.plain(0x08080a, 0.08, 0.1, { envMapIntensity: 1.4 });
      const pg = add(new THREE.Mesh(merge([[B(1.9, 0.32, 1.45), [0, 0.82, 0]], [B(0.08, 0.66, 0.08), [-0.85, 0.33, -0.6]], [B(0.08, 0.66, 0.08), [-0.85, 0.33, 0.6]], [B(0.08, 0.66, 0.08), [0.8, 0.33, 0]]]), lacquer));
      pg.position.set(px + 1, 0, pz + 1); pg.castShadow = true;
      const lid = add(new THREE.Mesh(B(1.8, 0.03, 1.4), lacquer));
      lid.position.set(px + 1.05, 1.25, pz + 0.65); lid.rotation.x = -0.6; lid.castShadow = true;
      const keys = add(new THREE.Mesh(B(0.2, 0.03, 1.3), MT.plain(0xf4f2ea, 0.3)));
      keys.position.set(px + 0.02, 0.98, pz + 1);
    }
    // 体育倉庫：跳び箱（段）、マットの山、ボールかご、白いライン入りのハードル
    const boxes = lists.box || [];
    const tobi = MT.surface('deskwood', 0xd8a868);
    inst(group, merge([0, 1, 2, 3].map((k) => [B(0.9 - k * 0.04, 0.2, 0.9 - k * 0.04), [0, 0.1 + k * 0.21, 0]])), tobi, boxes, (o, c) => { o.position.set(c.x + 0.5, 0, c.z + 0.5); o.rotation.y = (c.x + c.z) * 0.1; });
    inst(group, B(0.86, 0.06, 0.86), MT.surface('fabric', 0xf0ece0), boxes, (o, c) => { o.position.set(c.x + 0.5, 0.87, c.z + 0.5); o.rotation.y = (c.x + c.z) * 0.1; });
    const shedMats = [{ x: 9, z: 33 }, { x: 11.5, z: 33.3 }];
    inst(group, merge([0, 1, 2].map((k) => [B(1.8, 0.1, 0.95), [0, 0.05 + k * 0.105, 0]])), MT.surface('mat'), shedMats, (o, c) => { o.position.set(c.x, 0, c.z); o.rotation.y = c.x * 0.3; });
    const balls = [];
    for (let i = 0; i < 14; i++) balls.push({ x: 12.4 + (i % 3) * 0.22, z: 37.4 + Math.floor(i / 3) * 0.22, y: 0.62 + Math.floor(i / 9) * 0.2, c: i % 3 ? 0xd85a2a : 0xf0f0ea });
    inst(group, new THREE.SphereGeometry(0.11, 16, 12), MT.plain(0xffffff, 0.6), balls, (o, c) => { o.position.set(c.x, c.y, c.z); return c.c; });
    const cage = add(new THREE.Mesh(merge([[CY(0.4, 0.4, 0.02, 20), [0, 0.5, 0]], [CY(0.4, 0.4, 0.02, 20), [0, 0.95, 0]], [B(0.02, 0.95, 0.02), [0.38, 0.475, 0]], [B(0.02, 0.95, 0.02), [-0.38, 0.475, 0]], [B(0.02, 0.95, 0.02), [0, 0.475, 0.38]], [B(0.02, 0.95, 0.02), [0, 0.475, -0.38]]]), steel));
    cage.position.set(12.6, 0, 37.7);
    // 裸電球（体育倉庫）
    const bulb = add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), MT.glow(0xffc070, 4)));
    bulb.position.set(9.5, 2.4, 35.5);

    // 保健室のベッド：白いシーツ・枕・仕切りのカーテン
    const beds = lists.bed || [];
    inst(group, B(0.98, 0.25, 0.98), MT.plain(0xb8bcc0, 0.4, 0.6), beds, (o, c) => { o.position.set(c.x + 0.5, 0.2, c.z + 0.5); });
    inst(group, B(0.96, 0.2, 0.96), MT.surface('fabric', 0xf4f4f0), beds, (o, c) => { o.position.set(c.x + 0.5, 0.42, c.z + 0.5); });
    inst(group, B(0.4, 0.1, 0.25), MT.surface('fabric', 0xffffff), beds.filter((c) => (c.z % 2) === 0), (o, c) => { o.position.set(c.x + 0.5, 0.58, c.z + 0.3); });
    inst(group, B(0.03, 1.8, 2.0), MT.surface('fabric', 0xb8d4e0, { side: THREE.DoubleSide }), [{ x: 17.3, z: 21 }, { x: 17.3, z: 25 }], (o, c) => { o.position.set(c.x, 1.0, c.z); }, 'receive');

    // 自転車置き場：車輪とフレーム、屋根
    const bikes = lists.bike || [];
    const wheel = new THREE.TorusGeometry(0.3, 0.025, 8, 20);
    inst(group, merge([[wheel, [0, 0.32, -0.45], [0, Math.PI / 2, 0]], [wheel, [0, 0.32, 0.45], [0, Math.PI / 2, 0]]]), MT.plain(0x1a1a1a, 0.7), bikes, (o, c) => { o.position.set(c.x + 0.5, 0, c.z + 0.5); o.rotation.y = 0.05 * ((c.x % 3) - 1); });
    inst(group, merge([[B(0.04, 0.04, 0.9), [0, 0.55, 0], [0.4, 0, 0]], [B(0.04, 0.5, 0.04), [0, 0.6, -0.25]], [B(0.04, 0.04, 0.5), [0, 0.95, -0.3]], [B(0.04, 0.45, 0.04), [0, 0.55, 0.32], [0.3, 0, 0]]]), MT.plain(0x3a6aa8, 0.35, 0.6), bikes, (o, c) => { o.position.set(c.x + 0.5, 0, c.z + 0.5); return [0x3a6aa8, 0xb83030, 0x2a2a2a, 0xd8d8d8][c.x % 4]; });
    const roof = add(new THREE.Mesh(B(13, 0.08, 2.4), MT.plain(0x6a7076, 0.5, 0.6)));
    roof.position.set(50, 2.3, 31.5); roof.castShadow = true;
    inst(group, B(0.08, 2.3, 0.08), steel, [43.5, 50, 56.5].map((x) => ({ x })), (o, c) => { o.position.set(c.x, 1.15, 30.5); });

    // 木：幹と、重ねた葉のかたまり（少しずつ形と色を変える）
    const trees = lists.tree || [];
    inst(group, CY(0.12, 0.2, 2.2, 10), MT.surface('concrete', 0x6a4a30), trees, (o, c) => { o.position.set(c.x + 0.5, 1.1, c.z + 0.5); });
    const leafGeo = new THREE.IcosahedronGeometry(1, 2);
    const lp = leafGeo.attributes.position;
    for (let i = 0; i < lp.count; i++) { const k = 0.82 + Math.random() * 0.3; lp.setXYZ(i, lp.getX(i) * k, lp.getY(i) * k, lp.getZ(i) * k); }
    leafGeo.computeVertexNormals();
    const leaves = MT.surface('grass', 0x7aa060, { roughness: 0.9 });
    const blobs = [];
    trees.forEach((c) => { [[0, 2.6, 0, 1.2], [0.5, 3.1, 0.2, 0.85], [-0.45, 3.0, -0.25, 0.9], [0.1, 3.5, -0.1, 0.7]].forEach(([dx, y, dz, s]) => blobs.push({ x: c.x + 0.5 + dx, y, z: c.z + 0.5 + dz, s, t: (c.x + c.z) % 3 })); });
    inst(group, leafGeo, leaves, blobs, (o, c) => { o.position.set(c.x, c.y, c.z); o.scale.setScalar(c.s); o.rotation.y = c.x; return [0x8ab070, 0x6a9a58, 0x9ab878][c.t]; });

    // フェンス（金網）：支柱と、透ける網
    const fence = lists.fence || [];
    const netTex = cv(64, 64, (x) => { x.clearRect(0, 0, 64, 64); x.strokeStyle = 'rgba(190,200,190,.9)'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 0); x.lineTo(64, 64); x.moveTo(64, 0); x.lineTo(0, 64); x.stroke(); });
    netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping; netTex.repeat.set(4, 7);
    const netMat = new THREE.MeshStandardMaterial({ map: netTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.6, color: 0x9aa89a });
    inst(group, new THREE.PlaneGeometry(1, 1.8), netMat, fence, (o, c) => {
      const horiz = c.z === 0 || c.z === M.H - 1;
      o.position.set(c.x + 0.5, 0.9, c.z + 0.5);
      if (!horiz) o.rotation.y = Math.PI / 2;
    }, false);
    inst(group, CY(0.04, 0.04, 1.9, 8), MT.plain(0x5a6a5c, 0.5, 0.6), fence.filter((c) => (c.x + c.z) % 2 === 0), (o, c) => { o.position.set(c.x + 0.5, 0.95, c.z + 0.5); });
    // 正門（鎖で封鎖）と裏門
    inst(group, merge([[B(1, 0.06, 0.06), [0, 1.5, 0]], [B(1, 0.06, 0.06), [0, 0.15, 0]], ...[-0.4, -0.2, 0, 0.2, 0.4].map((x) => [B(0.04, 1.4, 0.04), [x, 0.82, 0]])]), MT.plain(0x8a9098, 0.35, 0.8), lists.gate || [], (o, c) => { o.position.set(c.x + 0.5, 0, c.z + 0.5); });
    const chain = add(new THREE.Mesh(CY(0.03, 0.03, 5.6, 8), MT.plain(0xc8a040, 0.3, 0.9)));
    chain.rotation.z = Math.PI / 2; chain.position.set(32, 1.0, M.H - 0.4);
    const keep = add(new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.4), new THREE.MeshStandardMaterial({ map: plateTex('封鎖中'), roughness: 0.6 })));
    keep.position.set(32, 1.5, M.H - 0.32);
    const backGate = new THREE.Group();
    for (let z = 36; z <= 38; z++) {
      const b = new THREE.Mesh(merge([[B(0.06, 0.06, 1), [0, 1.5, 0]], [B(0.06, 0.06, 1), [0, 0.15, 0]], ...[-0.4, -0.2, 0, 0.2, 0.4].map((zz) => [B(0.04, 1.4, 0.04), [0, 0.82, zz]])]), MT.plain(0x7a8088, 0.35, 0.8));
      b.position.set(M.W - 0.5, 0, z + 0.5); b.castShadow = true;
      backGate.add(b);
    }
    group.add(backGate);
    const bg = add(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.26), new THREE.MeshStandardMaterial({ map: plateTex('裏門'), roughness: 0.6 })));
    bg.position.set(M.W - 0.96, 1.85, 37.5); bg.rotation.y = -Math.PI / 2;

    // ===================== 廊下の小物 =====================
    // 掲示板とポスター、消火器と赤いランプの消火栓、非常口の誘導灯、部屋の札
    const corrBoards = [[10, 13.97], [21.5, 13.97], [32, 13.97], [54, 13.97], [11, 17.03], [20, 17.03], [47, 17.03]];
    corrBoards.forEach(([x, z], i) => {
      const north = z < 15;
      const b = add(new THREE.Mesh(B(1.8, 1.0, 0.03), MT.plain(0x8a6a44, 0.9)));
      b.position.set(x, 1.6, z + (north ? 0.02 : -0.02));
      for (let k = 0; k < 3; k++) {
        const pm = add(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.6), new THREE.MeshStandardMaterial({ map: posterTex[(i * 3 + k) % posterTex.length], roughness: 0.85 })));
        pm.position.set(x - 0.55 + k * 0.55, 1.6, z + (north ? 0.04 : -0.04));
        pm.rotation.y = north ? 0 : Math.PI;
        pm.rotation.z = (k - 1) * 0.03;
      }
    });
    const ext = [[15.5, 13.85], [37.5, 13.85], [57.5, 13.85], [22.5, 17.15], [40.5, 17.15]];
    inst(group, merge([[CY(0.08, 0.08, 0.45, 14), [0, 0.23, 0]], [CY(0.03, 0.04, 0.08, 10), [0, 0.5, 0]]]), MT.plain(0xc8201a, 0.3, 0.2), ext, (o, c) => { o.position.set(c[0], 0, c[1]); });
    const hyd = [[26.5, 13.9], [48.5, 13.9]];
    inst(group, B(0.7, 0.9, 0.12), MT.plain(0xb81c18, 0.35, 0.3), hyd, (o, c) => { o.position.set(c[0], 0.9, c[1]); });
    inst(group, new THREE.SphereGeometry(0.06, 12, 8), MT.glow(0xff2a20, 4), hyd, (o, c) => { o.position.set(c[0], 1.5, c[1] + 0.05); }, false);
    const exitMat = new THREE.MeshBasicMaterial({ map: exitTex, color: new THREE.Color(1.8, 1.8, 1.8), toneMapped: false });
    [[5.05, 15.5, Math.PI / 2], [58.95, 15.5, -Math.PI / 2], [27, 26.97, Math.PI]].forEach(([x, z, r]) => {
      const m = add(new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), exitMat));
      m.position.set(x, 2.45, z); m.rotation.y = r;
    });
    const plates = [
      ['1年A組', 10, 13.92, 0], ['2年A組', 21, 13.92, 0], ['2年B組', 32, 13.92, 0], ['音楽室', 43, 13.92, 0], ['3年A組', 54, 13.92, 0],
      ['職員室', 7.5, 17.08, Math.PI], ['保健室', 16.5, 17.08, Math.PI], ['昇降口', 27, 17.08, Math.PI], ['放送室', 35.5, 17.08, Math.PI], ['用務員室', 43.5, 17.08, Math.PI], ['理科室', 53.5, 17.08, Math.PI],
      ['体育倉庫', 15.08, 34.5, -Math.PI / 2],
    ];
    plates.forEach(([t, x, z, r]) => {
      // 戸口の上の壁に貼った室名札（カメラの高さに出っ張らないよう、平らに貼る）
      const p = add(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.26), new THREE.MeshStandardMaterial({ map: plateTex(t), roughness: 0.6 })));
      if (r === -Math.PI / 2) { p.position.set(15.02, 2.1, z); p.rotation.y = Math.PI / 2; return; }
      p.position.set(x, 2.45, r === 0 ? 14.02 : 16.98);
      p.rotation.y = r === 0 ? 0 : Math.PI;
    });

    // ===================== 敷地の外 =====================
    // パトカー（光る回転灯）、まわりの建物（窓に明かり）、街灯
    const lights = [];
    const carBody = MT.plain(0xf2f2f2, 0.25, 0.3, { envMapIntensity: 1.3 }), carDark = MT.plain(0x101214, 0.2, 0.4, { envMapIntensity: 1.3 });
    const policeCar = (x, z, rot) => {
      const g = new THREE.Group();
      const part = (w, h, d, m, y, zz) => { const p = new THREE.Mesh(B(w, h, d), m); p.position.set(0, y, zz); p.castShadow = true; g.add(p); };
      part(1.8, 0.55, 4.2, carBody, 0.55, 0); part(1.82, 0.32, 4.22, carDark, 0.36, 0); part(1.62, 0.5, 2.1, carDark, 1.05, -0.2);
      [[-0.85, 1.4], [0.85, 1.4], [-0.85, -1.4], [0.85, -1.4]].forEach(([wx, wz]) => { const w = new THREE.Mesh(CY(0.33, 0.33, 0.24, 14), carDark); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.33, wz); g.add(w); });
      const r = new THREE.Mesh(B(0.42, 0.16, 0.3), MT.glow(0xff1a10, 5)); r.position.set(-0.3, 1.38, -0.2);
      const b = new THREE.Mesh(B(0.42, 0.16, 0.3), MT.glow(0x1a40ff, 5)); b.position.set(0.3, 1.38, -0.2);
      g.add(r, b); lights.push(r, b);
      g.position.set(x, 0, z); g.rotation.y = rot;
      group.add(g);
    };
    policeCar(26, M.H + 4, Math.PI / 2.3); policeCar(37, M.H + 4.5, -Math.PI / 2.2); policeCar(31, M.H + 7.5, Math.PI / 2); policeCar(M.W + 5, 30, 0.1);
    const cityWin = cv(128, 256, (x, w, h) => { x.fillStyle = '#1a1e26'; x.fillRect(0, 0, w, h); for (let r = 0; r < 16; r++) for (let c = 0; c < 8; c++) { if (Math.random() < 0.4) { x.fillStyle = Math.random() < 0.6 ? '#ffd890' : '#cfe0ff'; x.fillRect(c * 16 + 4, r * 16 + 4, 8, 9); } } });
    cityWin.wrapS = cityWin.wrapT = THREE.RepeatWrapping;
    [[-14, 20, 10, 30, 14], [M.W / 2, -12, 70, 10, 10], [M.W + 18, 20, 14, 40, 18], [M.W / 2, M.H + 20, 60, 12, 12], [-20, -10, 16, 16, 26], [M.W + 24, M.H + 16, 18, 18, 30]].forEach(([x, z, w, d, h]) => {
      const t = cityWin.clone(); t.needsUpdate = true; t.repeat.set(Math.max(w, d) / 8, h / 8);
      const m = add(new THREE.Mesh(B(w, h, d), new THREE.MeshStandardMaterial({ color: 0x3a3e46, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.9, map: t, roughness: 0.6 })));
      m.position.set(x, h / 2, z);
    });
    const poles = [[8, M.H + 2], [22, M.H + 2], [44, M.H + 2], [58, M.H + 2], [M.W + 2, 12], [M.W + 2, 26]];
    inst(group, CY(0.06, 0.08, 5, 8), MT.plain(0x4a4e52, 0.5, 0.7), poles, (o, c) => { o.position.set(c[0], 2.5, c[1]); });
    inst(group, B(0.5, 0.12, 0.25), MT.glow(0xffe0a0, 4), poles, (o, c) => { o.position.set(c[0], 5, c[1]); }, false);

    // ===================== 照明・動き =====================
    TG.gfx.setLightSources(sources);
    const occluders = [lockerMat].concat(shelfMats);
    let ft = 0;
    function update(t, dt) {
      shaftMat.uniforms.time.value = t;
      // ちらつく蛍光灯
      const on = Math.sin(t * 31) > 0.6 || Math.random() < 0.06;
      flickMat.color.setScalar(on ? 0.35 : 2.6);
      // ほこりがゆっくり舞う
      ft += dt || 0;
      dust.position.y = Math.sin(ft * 0.2) * 0.05;
      dust.rotation.y = Math.sin(ft * 0.05) * 0.002;
    }
    return { backGate, policeLights: lights, occluders, update, lightSources: sources };
  }

  TG.world = { build };
})();
