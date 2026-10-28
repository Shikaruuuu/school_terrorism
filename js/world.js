// 学校にテロリスト — マップから3Dの校舎を組み立てる
(function () {
  const M = TG.map;
  const { T, F } = M;

  function instanced(geo, material, list, place) {
    if (!list.length) return null;
    const mesh = new THREE.InstancedMesh(geo, material, list.length);
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    list.forEach((c, i) => {
      o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
      const color = place(o, c);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      if (color !== undefined) mesh.setColorAt(i, col.set(color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }

  function chalkboard(text) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#21382a'; x.fillRect(0, 0, 512, 128);
    x.strokeStyle = '#7b5a36'; x.lineWidth = 10; x.strokeRect(0, 0, 512, 128);
    x.fillStyle = 'rgba(240,240,230,.85)';
    x.font = '700 40px "Zen Kaku Gothic New", sans-serif';
    x.textBaseline = 'middle';
    x.fillText(text, 24, 64);
    const t = new THREE.CanvasTexture(c);
    return new THREE.Mesh(new THREE.PlaneGeometry(5, 1.25), new THREE.MeshBasicMaterial({ map: t }));
  }

  function plateSprite(text) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 72;
    const x = c.getContext('2d');
    x.fillStyle = '#f4efe1'; x.fillRect(4, 4, 248, 64);
    x.strokeStyle = '#2b251c'; x.lineWidth = 5; x.strokeRect(4, 4, 248, 64);
    x.fillStyle = '#1f1a12';
    x.font = '900 38px "Zen Kaku Gothic New", sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 128, 38);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
    s.scale.set(1.15, 0.32, 1);
    return s;
  }

  function build(scene) {
    const lists = {};
    const push = (k, v) => { (lists[k] = lists[k] || []).push(v); };
    for (let z = 0; z < M.H; z++) {
      for (let x = 0; x < M.W; x++) {
        const t = M.get(x, z);
        const c = { x, z, t, f: M.floor[z * M.W + x] };
        if (t !== T.WALL) push('floor', c);
        if (t === T.WALL) push('wall', c);
        else if (t === T.DESK) push('desk', c);
        else if (t === T.TDESK) push('tdesk', c);
        else if (t === T.LOCKER) push('locker', c);
        else if (t === T.SHELF) push('shelf', c);
        else if (t === T.PIANO) push('piano', c);
        else if (t === T.BOX) push('box', c);
        else if (t === T.BIKE) push('bike', c);
        else if (t === T.BED) push('bed', c);
        else if (t === T.TREE) push('tree', c);
        else if (t === T.FENCE) push('fence', c);
        else if (t === T.GATE) push('gate', c);
      }
    }
    const L = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
    const add = (m) => { if (m) scene.add(m); return m; };

    // 地面（敷地外）
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), L(0x2a2d2f));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(M.W / 2, -0.08, M.H / 2);
    scene.add(ground);
    // 道路
    const road = new THREE.Mesh(new THREE.PlaneGeometry(200, 7), L(0x3b3f43));
    road.rotation.x = -Math.PI / 2;
    road.position.set(M.W / 2, -0.07, M.H + 4.5);
    scene.add(road);
    const roadE = new THREE.Mesh(new THREE.PlaneGeometry(7, 200), L(0x3b3f43));
    roadE.rotation.x = -Math.PI / 2;
    roadE.position.set(M.W + 4.5, -0.069, M.H / 2);
    scene.add(roadE);

    // 床
    const FLOORC = {
      [F.GRASS]: [0x4c6b3c, 0x48663a],
      [F.CORR]: [0x9aa0a2, 0x949a9c],
      [F.WOOD]: [0xb48a5a, 0xa98152],
      [F.TILE]: [0xc9cdc6, 0xbfc3bc],
      [F.DIRT]: [0xb09a74, 0xab956f],
      [F.MAT]: [0x5b7fa8, 0x55789f],
    };
    add(instanced(new THREE.BoxGeometry(1, 0.1, 1), L(0xffffff), lists.floor, (o, c) => {
      o.position.set(c.x + 0.5, -0.05, c.z + 0.5);
      return FLOORC[c.f][(c.x + c.z) & 1];
    }));

    // 壁（本体＋天端）
    const WALL_H = 2.8;
    add(instanced(new THREE.BoxGeometry(1, WALL_H, 1), L(0xffffff), lists.wall, (o, c) => {
      o.position.set(c.x + 0.5, WALL_H / 2, c.z + 0.5);
      const inShed = c.x >= 5 && c.x <= 14 && c.z >= 31;
      return inShed ? 0xa8a090 : ((c.x + c.z) % 3 ? 0xe9e2cf : 0xe2dbc6);
    }));
    add(instanced(new THREE.BoxGeometry(1.001, 0.08, 1.001), L(0x4b463d), lists.wall, (o, c) => {
      o.position.set(c.x + 0.5, WALL_H + 0.04, c.z + 0.5);
    }));
    // 腰壁ライン
    add(instanced(new THREE.BoxGeometry(1.01, 0.5, 1.01), L(0x7d8a76), lists.wall, (o, c) => {
      o.position.set(c.x + 0.5, 0.25, c.z + 0.5);
    }));

    // 机
    add(instanced(new THREE.BoxGeometry(0.72, 0.05, 0.55), L(0xd4a668), lists.desk || [], (o, c) => { o.position.set(c.x + 0.5, 0.74, c.z + 0.45); }));
    add(instanced(new THREE.BoxGeometry(0.62, 0.7, 0.45), L(0x8b929a), lists.desk || [], (o, c) => { o.position.set(c.x + 0.5, 0.36, c.z + 0.45); }));
    add(instanced(new THREE.BoxGeometry(0.42, 0.42, 0.06), L(0x8a6a44), lists.desk || [], (o, c) => { o.position.set(c.x + 0.5, 0.7, c.z + 0.92); }));
    // 教卓・作業台
    add(instanced(new THREE.BoxGeometry(0.98, 0.82, 0.98), L(0x6e7a64), lists.tdesk || [], (o, c) => { o.position.set(c.x + 0.5, 0.41, c.z + 0.5); }));
    add(instanced(new THREE.BoxGeometry(1, 0.05, 1), L(0xbfa77a), lists.tdesk || [], (o, c) => { o.position.set(c.x + 0.5, 0.84, c.z + 0.5); }));
    // ロッカー
    const lockerMat = L(0x7b90a6), shelfMat = L(0x8b6a42);
    add(instanced(new THREE.BoxGeometry(0.86, 2.0, 0.92), lockerMat, lists.locker || [], (o, c) => { o.position.set(c.x + 0.52, 1.0, c.z + 0.5); }));
    add(instanced(new THREE.BoxGeometry(0.02, 0.06, 0.5), L(0x2c3440), lists.locker || [], (o, c) => { o.position.set(c.x + 0.08, 1.7, c.z + 0.5); }));
    add(instanced(new THREE.BoxGeometry(0.02, 0.06, 0.5), L(0x2c3440), lists.locker || [], (o, c) => { o.position.set(c.x + 0.08, 1.6, c.z + 0.5); }));
    // 棚
    add(instanced(new THREE.BoxGeometry(0.96, 1.9, 0.96), shelfMat, lists.shelf || [], (o, c) => { o.position.set(c.x + 0.5, 0.95, c.z + 0.5); }));
    // ピアノ
    add(instanced(new THREE.BoxGeometry(1, 1.0, 1), L(0x151515), lists.piano || [], (o, c) => { o.position.set(c.x + 0.5, 0.5, c.z + 0.5); }));
    // 跳び箱
    add(instanced(new THREE.BoxGeometry(0.94, 0.9, 0.94), L(0xc8a272), lists.box || [], (o, c) => { o.position.set(c.x + 0.5, 0.45, c.z + 0.5); }));
    add(instanced(new THREE.BoxGeometry(0.95, 0.06, 0.95), L(0xf0ece0), lists.box || [], (o, c) => { o.position.set(c.x + 0.5, 0.92, c.z + 0.5); }));
    // 自転車
    add(instanced(new THREE.BoxGeometry(0.12, 0.7, 0.95), L(0x50565c), lists.bike || [], (o, c) => { o.position.set(c.x + 0.5, 0.35, c.z + 0.5); }));
    add(instanced(new THREE.BoxGeometry(1, 0.06, 0.06), L(0x9aa0a6), lists.bike || [], (o, c) => { o.position.set(c.x + 0.5, 0.8, c.z + 0.5); }));
    // ベッド
    add(instanced(new THREE.BoxGeometry(0.98, 0.55, 0.98), L(0xeeeeea), lists.bed || [], (o, c) => { o.position.set(c.x + 0.5, 0.28, c.z + 0.5); }));

    // 木
    add(instanced(new THREE.CylinderGeometry(0.14, 0.2, 1.6, 8), L(0x6b4a2e), lists.tree || [], (o, c) => { o.position.set(c.x + 0.5, 0.8, c.z + 0.5); }));
    add(instanced(new THREE.IcosahedronGeometry(1.15, 1), L(0x2f6b3a, { flatShading: true }), lists.tree || [], (o, c) => {
      o.position.set(c.x + 0.5, 2.3, c.z + 0.5);
      o.rotation.y = (c.x * 7 + c.z) % 6;
      return (c.x + c.z) % 2 ? 0x2f6b3a : 0x3a7a40;
    }));

    // フェンス
    const fenceMat = L(0x5d7d66, { transparent: true, opacity: 0.55 });
    add(instanced(new THREE.BoxGeometry(1, 1.8, 1), fenceMat, lists.fence || [], (o, c) => {
      const horiz = c.z === 0 || c.z === M.H - 1;
      o.scale.set(horiz ? 1 : 0.06, 1, horiz ? 0.06 : 1);
      o.position.set(c.x + 0.5, 0.9, c.z + 0.5);
    }));
    // 正門
    add(instanced(new THREE.BoxGeometry(1, 1.6, 0.16), L(0x9aa0a6), lists.gate || [], (o, c) => { o.position.set(c.x + 0.5, 0.8, c.z + 0.5); }));
    const chain = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.12, 0.2), L(0xd8b04a));
    chain.position.set(32, 1.0, M.H - 0.4);
    scene.add(chain);
    const keepOut = plateSprite('封鎖中');
    keepOut.position.set(32, 2.2, M.H - 0.5);
    scene.add(keepOut);

    // 裏門
    const backGate = new THREE.Group();
    for (let z = 36; z <= 38; z++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.6, 1), L(0x7a8088));
      b.position.set(M.W - 0.5, 0.8, z + 0.5);
      backGate.add(b);
    }
    scene.add(backGate);
    const bgLabel = plateSprite('裏門');
    bgLabel.position.set(M.W - 1.2, 2.3, 37.5);
    scene.add(bgLabel);

    // 黒板
    const boards = { '1a': '1年A組　英語　be動詞', '2a': '5時間目　数学　x²−5x+6=0', '2b': '2年B組　国語　走れメロス', '3a': '3年A組　理科　電流と磁界', music: '♪ 合唱コンクール練習' };
    M.rooms.forEach((r) => {
      if (boards[r.id]) {
        const b = chalkboard(boards[r.id]);
        b.rotation.y = Math.PI / 2;
        b.position.set(r.x0 + 0.02, 1.45, 8.5);
        scene.add(b);
      }
    });
    // 部屋の札
    const plates = [
      ['1年A組', 10, 14.25], ['2年A組', 21, 14.25], ['2年B組', 32, 14.25], ['音楽室', 43, 14.25], ['3年A組', 54, 14.25],
      ['職員室', 7.5, 16.75], ['保健室', 16.5, 16.75], ['昇降口', 27, 16.75], ['放送室', 35.5, 16.75], ['用務員室', 43.5, 16.75], ['理科室', 53.5, 16.75],
      ['体育倉庫', 15.3, 34.5],
    ];
    plates.forEach(([t, x, z]) => {
      const s = plateSprite(t);
      s.position.set(x, 2.45, z);
      scene.add(s);
    });

    // 正門の外のパトカー
    const lights = [];
    const policeCar = (x, z, rot) => {
      const g = new THREE.Group();
      const part = (w, h, d, c, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), L(c)); m.position.set(0, y, z); g.add(m); };
      part(1.8, 0.6, 4, 0xf4f4f4, 0.5, 0);
      part(1.82, 0.3, 4.02, 0x111111, 0.35, 0);
      part(1.6, 0.5, 2, 0x111111, 1.05, -0.2);
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
      r.position.set(-0.3, 1.4, -0.2);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
      b.position.set(0.3, 1.4, -0.2);
      g.add(r, b);
      lights.push(r, b);
      g.position.set(x, 0, z); g.rotation.y = rot;
      scene.add(g);
    };
    policeCar(26, M.H + 4, Math.PI / 2.3);
    policeCar(37, M.H + 4.5, -Math.PI / 2.2);
    policeCar(31, M.H + 7.5, Math.PI / 2);
    policeCar(M.W + 5, 30, 0.1);

    // 校舎の外の建物（雰囲気）
    [[-12, 20, 10, 30], [M.W / 2, -10, 70, 10], [M.W + 16, 20, 14, 40], [M.W / 2, M.H + 18, 60, 12]].forEach(([x, z, w, d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 6, d), L(0x30363c));
      m.position.set(x, 3, z);
      scene.add(m);
    });

    // 天井（下向きの面だけなので、上空からは見えない）
    const ceilMat = new THREE.MeshLambertMaterial({ color: 0xe9e6dc, emissive: 0x8f8b80 });
    const ceiling = (x0, z0, x1, z1) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), ceilMat);
      m.rotation.x = Math.PI / 2;
      m.position.set((x0 + x1) / 2, WALL_H, (z0 + z1) / 2);
      scene.add(m);
    };
    ceiling(4, 3, 60, 28);
    ceiling(5, 31, 15, 40);
    // 蛍光灯
    const tubes = [];
    M.rooms.forEach((r) => {
      if (r.id === 'yard' || r.id === 'backyard') return;
      for (let z = r.z0 + 1; z <= r.z1; z += 3) for (let x = r.x0 + 1; x <= r.x1; x += 3) tubes.push({ x, z });
    });
    add(instanced(new THREE.BoxGeometry(1.2, 0.05, 0.16), new THREE.MeshBasicMaterial({ color: 0xf6f8ff }), tubes, (o, c) => { o.position.set(c.x + 0.5, WALL_H - 0.03, c.z + 0.5); }));

    // 肩越しカメラがロッカーや棚を越えるとき、半透明にして主人公を見せる
    return { backGate, policeLights: lights, occluders: [lockerMat, shelfMat] };
  }

  TG.world = { build };
})();
