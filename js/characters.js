// 学校にテロリスト — 人物モデル（関節つきの体と、描き込んだ顔）
// 体の各パーツは頂点カラーで1つのメッシュにまとめ、描画回数を抑える。
(function () {
  const MD = TG.models;
  const V3 = THREE.Vector3;
  const VC = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const col = new THREE.Color();

  // ---------- ジオメトリをまとめる ----------
  function P() { this.items = []; }
  P.prototype.add = function (geo, color, pos, rot, scale) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0));
    m.compose(new V3(pos[0], pos[1], pos[2]), q, new V3(scale ? scale[0] : 1, scale ? scale[1] : 1, scale ? scale[2] : 1));
    this.items.push({ geo, color, m });
    return this;
  };
  P.prototype.build = function () {
    const parts = this.items.map((it) => {
      const g = it.geo.index ? it.geo.toNonIndexed() : it.geo.clone();
      g.applyMatrix4(it.m);
      return [g, it.color];
    });
    let n = 0;
    parts.forEach(([g]) => { n += g.attributes.position.count; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), cl = new Float32Array(n * 3);
    let o = 0;
    parts.forEach(([g, c]) => {
      const cnt = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      col.set(c);
      for (let i = 0; i < cnt; i++) { cl[(o + i) * 3] = col.r; cl[(o + i) * 3 + 1] = col.g; cl[(o + i) * 3 + 2] = col.b; }
      o += cnt;
      g.dispose();
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(cl, 3));
    geo.computeBoundingSphere();
    return geo;
  };

  const geoCache = {};
  function cached(key, make) {
    if (!geoCache[key]) geoCache[key] = make().build();
    return new THREE.Mesh(geoCache[key], VC);
  }

  // よく使う形
  const G = {
    sph: new THREE.SphereGeometry(1, 16, 12),
    sphHi: new THREE.SphereGeometry(1, 20, 14),
    cap: (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10),
    cyl: (rt, rb, h, open) => new THREE.CylinderGeometry(rt, rb, h, 16, 1, !!open),
    box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  };

  // ---------- 顔のテクスチャ ----------
  // 球のUVは u=0.25 が正面。キャンバス 512x256 の x=128 が顔の中心、y=126 が目の高さ。
  const faceCache = {};
  const hex = (c) => '#' + new THREE.Color(c).getHexString();
  function shade(c, k) { const x = new THREE.Color(c); x.multiplyScalar(k); return '#' + x.getHexString(); }

  function faceTexture(o) {
    const key = JSON.stringify(o);
    if (faceCache[key]) return faceCache[key];
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const x = c.getContext('2d');
    const skin = hex(o.skin);
    const CX = 128, EY = 126;

    if (o.mask) {
      // 目出し帽：ニットの地
      x.fillStyle = '#1b1c1f'; x.fillRect(0, 0, 512, 256);
      x.strokeStyle = 'rgba(255,255,255,.05)'; x.lineWidth = 2;
      for (let i = 0; i < 512; i += 5) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 3, 256); x.stroke(); }
      // 目の穴
      x.fillStyle = skin;
      roundRect(x, CX - 50, EY - 20, 100, 34, 14); x.fill();
      x.strokeStyle = '#0c0d0f'; x.lineWidth = 4;
      roundRect(x, CX - 50, EY - 20, 100, 34, 14); x.stroke();
      x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(CX - 48, EY - 18, 96, 6);
    } else {
      // 肌：正面を明るく、横と顎の下を暗く
      x.fillStyle = skin; x.fillRect(0, 0, 512, 256);
      const side = x.createLinearGradient(0, 0, 512, 0);
      side.addColorStop(0, 'rgba(90,40,20,.18)'); side.addColorStop(0.25, 'rgba(90,40,20,0)'); side.addColorStop(0.5, 'rgba(90,40,20,.2)'); side.addColorStop(1, 'rgba(90,40,20,.18)');
      x.fillStyle = side; x.fillRect(0, 0, 512, 256);
      const chin = x.createLinearGradient(0, 160, 0, 220);
      chin.addColorStop(0, 'rgba(90,40,20,0)'); chin.addColorStop(1, 'rgba(90,40,20,.35)');
      x.fillStyle = chin; x.fillRect(0, 160, 512, 96);
      // 頬の赤み
      const blush = o.female ? 0.32 : 0.12;
      [-1, 1].forEach((s) => {
        const g = x.createRadialGradient(CX + s * 30, EY + 20, 2, CX + s * 30, EY + 20, 20);
        g.addColorStop(0, 'rgba(230,110,110,' + blush + ')'); g.addColorStop(1, 'rgba(230,110,110,0)');
        x.fillStyle = g; x.fillRect(CX + s * 30 - 22, EY, 44, 44);
      });
      if (o.stubble) {
        x.fillStyle = 'rgba(40,35,30,.35)';
        for (let i = 0; i < 900; i++) {
          const a = Math.random() * Math.PI, r = 30 + Math.random() * 26;
          x.fillRect(CX + Math.cos(a) * r * 1.2, EY + 12 + Math.sin(a) * r * 0.9, 1.4, 1.4);
        }
      }
      // 髪の生え際（後ろは襟足まで）
      x.fillStyle = hex(o.hair);
      x.beginPath();
      x.moveTo(0, 0);
      for (let px = 0; px <= 512; px += 4) {
        let d = Math.abs(px - CX); if (d > 256) d = 512 - d;
        const t = Math.min(1, Math.max(0, (d - 40) / 150));
        const s = t * t * (3 - 2 * t);
        let hy = (o.hairline || 92) + (o.nape || 82) * s;
        if (d < 70 && o.bangs) hy += 8 + Math.sin(px * 0.35) * 5;
        x.lineTo(px, hy);
      }
      x.lineTo(512, 0); x.closePath(); x.fill();
      // 鼻（影だけ。立体は別パーツ）
      x.strokeStyle = 'rgba(120,60,40,.35)'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(CX + 3, EY + 4); x.quadraticCurveTo(CX + 7, EY + 18, CX + 2, EY + 22); x.stroke();
      x.fillStyle = 'rgba(110,50,35,.45)';
      x.beginPath(); x.ellipse(CX - 4, EY + 23, 2.4, 1.4, 0, 0, Math.PI * 2); x.fill();
      x.beginPath(); x.ellipse(CX + 4, EY + 23, 2.4, 1.4, 0, 0, Math.PI * 2); x.fill();
      // 口
      const my = EY + 36;
      if (o.mouth === 'open') {
        x.fillStyle = '#5a2020'; x.beginPath(); x.ellipse(CX, my, 7, 5, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#f2f0ea'; x.fillRect(CX - 5, my - 5, 10, 2.5);
      } else {
        x.strokeStyle = o.female ? '#c4606a' : '#8f4f45'; x.lineWidth = o.female ? 3 : 2.4; x.lineCap = 'round';
        x.beginPath();
        const curve = o.mouth === 'frown' ? -3 : o.mouth === 'smile' ? 4 : 1;
        x.moveTo(CX - 11, my); x.quadraticCurveTo(CX, my + curve, CX + 11, my); x.stroke();
        x.fillStyle = o.female ? 'rgba(220,110,120,.55)' : 'rgba(170,90,80,.3)';
        x.beginPath(); x.ellipse(CX, my + 4, 7, 2.6, 0, 0, Math.PI * 2); x.fill();
      }
      if (o.scar) {
        x.strokeStyle = 'rgba(150,60,60,.8)'; x.lineWidth = 2.5;
        x.beginPath(); x.moveTo(CX + 14, EY - 24); x.lineTo(CX + 30, EY + 22); x.stroke();
      }
    }

    // 目と眉
    const ew = o.female ? 14 : 12.5, eh = o.female ? 8.2 : 6.6, gap = 25;
    [-1, 1].forEach((s) => {
      const ex = CX + s * gap;
      // 白目
      x.fillStyle = '#f6f3ee';
      x.beginPath(); x.ellipse(ex, EY, ew, eh, 0, 0, Math.PI * 2); x.fill();
      // 虹彩と瞳
      const ir = eh * 1.05;
      const ig = x.createRadialGradient(ex, EY, 1, ex, EY, ir);
      ig.addColorStop(0, '#2a1a10'); ig.addColorStop(0.6, hex(o.iris || 0x4a2e1c)); ig.addColorStop(1, '#1a0f08');
      x.save();
      x.beginPath(); x.ellipse(ex, EY, ew, eh, 0, 0, Math.PI * 2); x.clip();
      x.fillStyle = ig; x.beginPath(); x.arc(ex, EY + 0.5, ir, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#080605'; x.beginPath(); x.arc(ex, EY + 0.5, ir * 0.45, 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgba(255,255,255,.95)'; x.beginPath(); x.arc(ex - 2, EY - 2, 1.8, 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.arc(ex + 2.5, EY + 2.5, 1, 0, Math.PI * 2); x.fill();
      // 上まぶた
      x.fillStyle = 'rgba(80,40,25,.25)';
      x.fillRect(ex - ew, EY - eh, ew * 2, eh * 0.55);
      x.restore();
      x.strokeStyle = '#1a1210'; x.lineWidth = o.female ? 3 : 2.4; x.lineCap = 'round';
      x.beginPath(); x.ellipse(ex, EY + 0.5, ew + 0.5, eh + 0.5, 0, Math.PI * 1.05, Math.PI * 1.95); x.stroke();
      if (o.female) {
        for (let k = 0; k < 3; k++) {
          const ax = ex + s * (ew - 1 - k * 2.5);
          x.beginPath(); x.moveTo(ax, EY - eh + 1 + k); x.lineTo(ax + s * 3, EY - eh - 3 + k); x.stroke();
        }
      }
      x.strokeStyle = 'rgba(60,30,20,.35)'; x.lineWidth = 1.2;
      x.beginPath(); x.ellipse(ex, EY, ew, eh, 0, Math.PI * 0.15, Math.PI * 0.85); x.stroke();
      // 二重まぶたの線
      x.strokeStyle = 'rgba(90,45,30,.35)'; x.lineWidth = 1.2;
      x.beginPath(); x.ellipse(ex, EY - 1, ew, eh + 2.5, 0, Math.PI * 1.15, Math.PI * 1.85); x.stroke();
      // 眉
      const by = EY - (o.female ? 15 : 13);
      const angry = o.brow === 'angry' ? 5 : o.brow === 'worried' ? -4 : 0;
      x.strokeStyle = hex(o.mask ? 0x2a2420 : o.hair); x.lineWidth = o.female ? 2.6 : 3.6; x.lineCap = 'round';
      x.beginPath();
      x.moveTo(ex - s * 2 - s * 3, by + angry * 0.8);
      x.quadraticCurveTo(ex + s * 4, by - 3, ex + s * 13, by + 1 - angry * 0.4);
      x.stroke();
    });

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    faceCache[key] = t;
    return t;
  }
  function roundRect(x, l, t, w, h, r) {
    x.beginPath();
    x.moveTo(l + r, t); x.lineTo(l + w - r, t); x.quadraticCurveTo(l + w, t, l + w, t + r);
    x.lineTo(l + w, t + h - r); x.quadraticCurveTo(l + w, t + h, l + w - r, t + h);
    x.lineTo(l + r, t + h); x.quadraticCurveTo(l, t + h, l, t + h - r);
    x.lineTo(l, t + r); x.quadraticCurveTo(l, t, l + r, t); x.closePath();
  }
  const headGeo = new THREE.SphereGeometry(0.112, 32, 24);

  // ---------- 体の寸法 ----------
  const HIP = 0.88, THIGH = 0.41, SHIN = 0.41, UPPER = 0.27, FORE = 0.25, SHOULDER = 0.41, NECK = 0.56, HEAD_C = 0.115;

  // o: { kind: 'gakuran'|'sailor'|'terror', skin, hair, hairStyle, iris, mouth, brow, boss, scale }
  function human(o) {
    const sk = o.skin || 0xeec3a0;
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    const hips = new THREE.Group();
    hips.position.y = HIP;
    body.add(hips);
    const k = o.kind;
    const top = k === 'gakuran' ? 0x181b24 : k === 'sailor' ? 0x1b2443 : o.boss ? 0x26272a : 0x4b5139;
    const pants = k === 'gakuran' ? 0x181b24 : k === 'terror' ? (o.boss ? 0x1d1e21 : 0x3d4034) : null;

    // --- 胴体（首・肩・服の飾り・銃までひとまとめ） ---
    const torsoKey = 'torso|' + k + '|' + (o.boss ? 1 : 0);
    hips.add(cached(torsoKey, () => {
      const p = new P();
      const prof = [[0.0, -0.06], [0.15, -0.05], [0.155, 0.02], [0.13, 0.12], [0.15, 0.24], [0.17, 0.34], [0.165, 0.42], [0.11, 0.48], [0.05, 0.5]].map(([r, y]) => new THREE.Vector2(r, y));
      p.add(new THREE.LatheGeometry(prof, 18), top, [0, 0, 0], null, [1, 1, 0.66]);
      p.add(G.cyl(0.045, 0.05, 0.12), k === 'terror' && !o.boss ? 0x1b1c1f : sk, [0, NECK - 0.02, 0.005]);
      [-1, 1].forEach((s) => p.add(G.sph, top, [s * 0.165, SHOULDER, 0], null, [0.07, 0.065, 0.07]));
      if (k === 'gakuran') {
        // 学ラン：立て襟、白いカラー、金ボタン、裾
        p.add(G.cyl(0.062, 0.07, 0.07, true), 0x14161d, [0, 0.5, 0], null, [1, 1, 0.85]);
        p.add(G.cyl(0.063, 0.063, 0.012, true), 0xf2f2ee, [0, 0.536, 0], null, [1, 1, 0.85]);
        for (let i = 0; i < 5; i++) p.add(G.sph, 0xd9b44a, [0, 0.43 - i * 0.095, 0.103 - (i > 2 ? 0.004 : 0)], null, [0.011, 0.011, 0.008]);
        p.add(G.box(0.3, 0.012, 0.012), 0x0d0f14, [0, -0.04, 0.1]);
      } else if (k === 'sailor') {
        // セーラー服：白い襟（後ろの四角と前のV）、紺のライン、赤いスカーフ
        p.add(G.box(0.27, 0.2, 0.012), 0xf3f3ef, [0, 0.37, -0.115], [0.25, 0, 0]);
        p.add(G.box(0.25, 0.012, 0.014), 0x1b2443, [0, 0.29, -0.104], [0.25, 0, 0]);
        [-1, 1].forEach((s) => p.add(G.box(0.05, 0.2, 0.012), 0xf3f3ef, [s * 0.06, 0.4, 0.1], [-0.15, 0, s * 0.55]));
        p.add(new THREE.ConeGeometry(0.035, 0.11, 4), 0xc8262f, [0, 0.33, 0.115], [Math.PI, 0, 0]);
        p.add(G.sph, 0xc8262f, [0, 0.39, 0.112], null, [0.03, 0.022, 0.015]);
        // プリーツスカート
        p.add(G.cyl(0.16, 0.25, 0.3, true), 0x1b2443, [0, -0.15, 0], null, [1, 1, 0.8]);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          p.add(G.box(0.008, 0.29, 0.006), 0x111829, [Math.sin(a) * 0.205, -0.15, Math.cos(a) * 0.205 * 0.8], [0.27 * Math.cos(a), a, -0.27 * Math.sin(a) * 0]);
        }
      } else {
        // 戦闘服：ベスト、ポーチ、ベルト、肩ひも、銃
        const vest = o.boss ? 0x521616 : 0x2c2f23;
        p.add(G.box(0.3, 0.3, 0.21), vest, [0, 0.27, 0]);
        [-0.09, 0, 0.09].forEach((xx) => p.add(G.box(0.07, 0.09, 0.05), 0x363a2b, [xx, 0.2, 0.12]));
        p.add(G.box(0.06, 0.08, 0.04), 0x363a2b, [0.08, 0.33, 0.12]);
        p.add(G.box(0.32, 0.045, 0.22), 0x1a1b17, [0, 0.0, 0]);
        p.add(G.box(0.05, 0.05, 0.03), 0x8a8a7a, [0, 0.0, 0.112]);
        [-1, 1].forEach((s) => p.add(G.box(0.045, 0.02, 0.23), vest, [s * 0.1, 0.43, 0]));
        if (o.boss) p.add(G.cyl(0.072, 0.072, 0.06, true), 0xb81f1f, [-0.2, 0.31, 0]);
        // 小銃（体の前に構える）
        const gun = [0.07, 0.24, 0.27];
        p.add(G.box(0.05, 0.08, 0.32), 0x1c1c1c, gun);
        p.add(G.cyl(0.013, 0.013, 0.3), 0x111111, [gun[0], gun[1] + 0.02, gun[2] + 0.3], [Math.PI / 2, 0, 0]);
        p.add(G.box(0.04, 0.13, 0.05), 0x222222, [gun[0], gun[1] - 0.09, gun[2] + 0.05], [0.25, 0, 0]);
        p.add(G.box(0.045, 0.08, 0.16), 0x2a2a2a, [gun[0], gun[1] - 0.02, gun[2] - 0.22]);
        p.add(G.box(0.035, 0.035, 0.1), 0x0e0e0e, [gun[0], gun[1] + 0.06, gun[2]]);
      }
      return p;
    }));

    // --- 頭 ---
    const head = new THREE.Group();
    head.position.y = NECK - 0.01;
    hips.add(head);
    const faceTex = faceTexture({ skin: sk, hair: o.hair || 0x15110e, female: k === 'sailor', mask: k === 'terror' && !o.boss, iris: o.iris, mouth: o.mouth, brow: o.brow, hairline: o.hairline, nape: o.nape, bangs: o.hairStyle === 'long' || o.hairStyle === 'bob', stubble: o.boss, scar: o.boss });
    // 顔は少し自発光させて、天井の照明だけでも表情が読めるようにする
    const face = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ map: faceTex, emissive: 0x4a4a4a, emissiveMap: faceTex }));
    face.position.y = HEAD_C;
    face.scale.set(1, 1.16, 1.04);
    head.add(face);
    const headKey = 'head|' + k + '|' + (o.hairStyle || '') + '|' + (o.hair || 0) + '|' + sk + '|' + (o.boss ? 1 : 0);
    head.add(cached(headKey, () => {
      const p = new P();
      const hc = HEAD_C;
      const earC = k === 'terror' && !o.boss ? 0x1b1c1f : sk;
      [-1, 1].forEach((s) => p.add(G.sph, earC, [s * 0.108, hc - 0.005, -0.005], null, [0.014, 0.03, 0.022]));
      if (!(k === 'terror' && !o.boss)) {
        p.add(G.sph, sk, [0, hc - 0.016, 0.108], [0.3, 0, 0], [0.011, 0.02, 0.014]);
      } else {
        p.add(G.sph, 0x1b1c1f, [0, hc - 0.012, 0.11], [0.3, 0, 0], [0.014, 0.024, 0.02]);
        // 額に上げたゴーグル
        p.add(G.box(0.2, 0.045, 0.05), 0x2b2b2b, [0, hc + 0.085, 0.085], [-0.4, 0, 0]);
        [-1, 1].forEach((s) => p.add(G.cyl(0.026, 0.026, 0.02), 0x3a5a6a, [s * 0.045, hc + 0.09, 0.112], [Math.PI / 2 - 0.4, 0, 0]));
        p.add(G.cyl(0.118, 0.118, 0.02, true), 0x2b2b2b, [0, hc + 0.08, 0], [-0.25, 0, 0], [1, 1, 1.05]);
      }
      const hr = o.hair || 0x15110e;
      const st = o.hairStyle;
      if (o.boss) {
        // ベレー帽
        p.add(G.sph, 0x7a1414, [0.015, hc + 0.1, -0.01], [0, 0, -0.18], [0.13, 0.045, 0.13]);
        p.add(G.sph, 0xd9b44a, [-0.06, hc + 0.11, 0.09], null, [0.014, 0.014, 0.008]);
      } else if (k !== 'terror') {
        // 髪のボリューム（頭頂〜後頭部）
        // 前は額の上まで、後ろは襟足まで来るように後ろへ傾ける
        const cap = new THREE.SphereGeometry(0.125, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5);
        p.add(cap, hr, [0, hc + 0.012, -0.006], [-0.4, 0, 0], [0.97, 1.12, 1.02]);
        if (st === 'spiky') {
          for (let i = 0; i < 9; i++) {
            const a = (i / 9) * Math.PI * 2;
            p.add(new THREE.ConeGeometry(0.03, 0.08, 5), hr, [Math.sin(a) * 0.07, hc + 0.12, Math.cos(a) * 0.06 - 0.01], [Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6]);
          }
        }
        if (st === 'short' || st === 'spiky') {
          // 前髪をすこし
          for (let i = -2; i <= 2; i++) p.add(new THREE.ConeGeometry(0.022, 0.07, 4), hr, [i * 0.03, hc + 0.085, 0.098], [2.6, 0, i * 0.12]);
        }
        if (st === 'long' || st === 'bob' || st === 'pony') {
          // ぱっつん気味の前髪と、顔の横の髪
          for (let i = -3; i <= 3; i++) p.add(G.box(0.032, 0.05, 0.02), hr, [i * 0.027, hc + 0.098, 0.1 - Math.abs(i) * 0.008], [-0.3, 0, 0]);
          [-1, 1].forEach((s) => p.add(G.box(0.025, st === 'bob' ? 0.14 : 0.2, 0.05), hr, [s * 0.112, hc - (st === 'bob' ? 0.04 : 0.07), 0.035]));
        }
        if (st === 'long') p.add(new THREE.CylinderGeometry(0.12, 0.14, 0.34, 16, 1, true, Math.PI * 0.55, Math.PI * 0.9), hr, [0, hc - 0.13, -0.01]);
        if (st === 'bob') p.add(new THREE.CylinderGeometry(0.122, 0.13, 0.16, 16, 1, true, Math.PI * 0.5, Math.PI), hr, [0, hc - 0.05, 0]);
        if (st === 'pony') {
          p.add(G.sph, hr, [0, hc + 0.02, -0.14], null, [0.045, 0.1, 0.045]);
          p.add(G.sph, 0xc8262f, [0, hc + 0.08, -0.125], null, [0.02, 0.02, 0.02]);
        }
      }
      return p;
    }));

    // --- 腕 ---
    const sleeve = k === 'terror' ? top : top;
    const hand = k === 'terror' ? 0x161616 : sk;
    const mkArm = (s) => {
      const sh = new THREE.Group();
      sh.position.set(s * 0.2, SHOULDER - 0.01, 0);
      hips.add(sh);
      sh.add(cached('upper|' + k + '|' + (o.boss ? 1 : 0), () => new P().add(G.cap(0.043, UPPER - 0.07), sleeve, [0, -UPPER / 2, 0])));
      const el = new THREE.Group();
      el.position.y = -UPPER;
      sh.add(el);
      el.add(cached('fore|' + k + '|' + hand + '|' + s, () => {
        const p = new P();
        p.add(G.cap(0.038, FORE - 0.08), sleeve, [0, -FORE / 2 + 0.01, 0]);
        if (k === 'sailor') p.add(G.cyl(0.04, 0.04, 0.025, true), 0xf3f3ef, [0, -FORE + 0.05, 0]);
        // 手のひら・指・親指
        p.add(G.box(0.07, 0.085, 0.03), hand, [0, -FORE - 0.035, 0]);
        for (let i = 0; i < 4; i++) p.add(G.cap(0.008, 0.04), hand, [-0.025 + i * 0.017, -FORE - 0.1, 0.004]);
        p.add(G.cap(0.009, 0.03), hand, [-s * 0.04, -FORE - 0.04, 0.012], [0, 0, s * 0.6]);
        return p;
      }));
      return { sh, el };
    };
    const aL = mkArm(-1), aR = mkArm(1);

    // --- 脚 ---
    const female = k === 'sailor';
    const mkLeg = (s) => {
      const hp = new THREE.Group();
      hp.position.set(s * 0.085, HIP, 0);
      body.add(hp);
      hp.add(cached('thigh|' + k + '|' + sk, () => new P().add(G.cap(female ? 0.052 : 0.06, THIGH - 0.08), female ? sk : pants, [0, -THIGH / 2, 0])));
      const kn = new THREE.Group();
      kn.position.y = -THIGH;
      hp.add(kn);
      kn.add(cached('shin|' + k + '|' + sk, () => {
        const p = new P();
        if (female) {
          p.add(G.cap(0.044, SHIN - 0.2), sk, [0, -0.05, 0]);
          p.add(G.cap(0.046, SHIN - 0.22), 0x1d2131, [0, -SHIN / 2 - 0.06, 0]); // 紺のハイソックス
        } else {
          p.add(G.cap(0.05, SHIN - 0.08), pants, [0, -SHIN / 2, 0]);
          if (k === 'terror') p.add(G.box(0.1, 0.09, 0.05), 0x222222, [0, -0.02, 0.045]); // ニーパッド
        }
        // 靴：生徒は上履き（白に学年色のつま先）、敵はブーツ
        if (k === 'terror') {
          p.add(G.box(0.1, 0.12, 0.13), 0x141414, [0, -SHIN + 0.02, 0]);
          p.add(G.box(0.1, 0.07, 0.25), 0x141414, [0, -SHIN - 0.03, 0.05]);
        } else {
          p.add(G.cap(0.042, 0.15), 0xf1f1ec, [0, -SHIN - 0.025, 0.05], [Math.PI / 2, 0, 0], [1.15, 1, 0.8]);
          p.add(G.sph, 0x2f6fd0, [0, -SHIN - 0.03, 0.14], null, [0.044, 0.03, 0.03]);
        }
        return p;
      }));
      return { hp, kn };
    };
    const lL = mkLeg(-1), lR = mkLeg(1);

    // 足元の影
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.34, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    g.add(shadow);

    if (o.scale) body.scale.setScalar(o.scale);
    return { group: g, body, hips, head, aL, aR, lL, lR, kind: k, walkT: Math.random() * 6 };
  }

  // ---------- ポーズ ----------
  // mode: 'stand' | 'crouch' | 'sit' | 'down' | 'tied'
  function pose(p, mode, moving, dt, speed) {
    const b = p.body;
    p.walkT += (dt || 0) * (speed || 6);
    const s = moving ? Math.sin(p.walkT) : 0;
    const c = moving ? Math.cos(p.walkT) : 0;
    b.rotation.set(0, 0, 0);
    b.position.set(0, 0, 0);
    p.hips.rotation.set(0, 0, 0);
    p.head.rotation.set(0, 0, 0);
    const armSet = (a, sx, sz, ex) => { a.sh.rotation.set(sx, 0, sz); a.el.rotation.set(ex, 0, 0); };
    const legSet = (l, hx, kx) => { l.hp.rotation.set(hx, 0, 0); l.kn.rotation.set(kx, 0, 0); };
    const terror = p.kind === 'terror';

    if (mode === 'stand') {
      legSet(p.lL, -s * 0.5, Math.max(0, s) * 0.8 + 0.05);
      legSet(p.lR, s * 0.5, Math.max(0, -s) * 0.8 + 0.05);
      b.position.y = moving ? -Math.abs(c) * 0.03 : 0;
      p.hips.rotation.y = s * 0.06;
      if (terror) {
        // 左手は銃身、右手はグリップ
        armSet(p.aL, -1.14 + s * 0.05, 0.58, -0.2);
        armSet(p.aR, -0.3, -0.25, -1.3);
      } else {
        armSet(p.aL, s * 0.45, 0.06, -0.25 - Math.max(0, s) * 0.3);
        armSet(p.aR, -s * 0.45, -0.06, -0.25 - Math.max(0, -s) * 0.3);
      }
    } else if (mode === 'crouch') {
      b.position.y = -0.33;
      p.hips.rotation.x = 0.35;
      legSet(p.lL, -1.2 - s * 0.25, 1.3 + s * 0.2);
      legSet(p.lR, -1.2 + s * 0.25, 1.3 - s * 0.2);
      p.head.rotation.x = -0.3;
      if (!terror) { armSet(p.aL, -0.5, 0.1, -0.8); armSet(p.aR, -0.5, -0.1, -0.8); }
    } else if (mode === 'sit') {
      // 体育座り（膝を抱える）
      b.position.y = -0.68;
      p.hips.rotation.x = 0.15;
      legSet(p.lL, -2.0, 2.3);
      legSet(p.lR, -2.0, 2.3);
      armSet(p.aL, -1.0, 0.22, -0.35);
      armSet(p.aR, -1.0, -0.22, -0.35);
      p.head.rotation.x = 0.25;
    } else if (mode === 'down' || mode === 'tied') {
      b.rotation.x = -Math.PI / 2;
      b.position.y = 0.12;
      b.position.z = 0.8;
      legSet(p.lL, 0.05, 0.1);
      legSet(p.lR, -0.08, 0.15);
      if (mode === 'tied') { armSet(p.aL, 0.4, 0.2, -0.3); armSet(p.aR, 0.4, -0.2, -0.3); }
      else { armSet(p.aL, -2.4, 0.3, -0.4); armSet(p.aR, -0.3, -0.4, -0.2); }
      p.head.rotation.y = 0.5;
    }
  }

  // ---------- 登場人物 ----------
  const SKINS = [0xeec3a0, 0xf2cdb0, 0xe2b48f, 0xe9bb98];
  const HAIRS = [0x15110e, 0x231710, 0x2e2015, 0x1a1512, 0x3b2a1c];
  const BOY_STYLES = ['short', 'spiky', 'short'];
  const GIRL_STYLES = ['long', 'bob', 'pony'];

  function player() { return human({ kind: 'gakuran', hair: 0x15110e, hairStyle: 'short' }); }
  function terrorist(boss) {
    return human({ kind: 'terror', boss, skin: boss ? 0xd8a982 : 0xdcae8c, hair: 0x1a1512, brow: 'angry', mouth: 'frown', scale: boss ? 1.16 : 1.1, hairline: boss ? 78 : undefined, nape: boss ? 70 : undefined, iris: 0x2a2a2a });
  }
  function girl() {
    return human({ kind: 'sailor', hair: 0x2a1a12, hairStyle: 'long', skin: 0xf3d0b6, iris: 0x5a3420, brow: 'worried', mouth: 'calm' });
  }
  function student(i) {
    const female = i % 2 === 1;
    return human({
      kind: female ? 'sailor' : 'gakuran',
      skin: SKINS[i % SKINS.length],
      hair: HAIRS[(i * 3) % HAIRS.length],
      hairStyle: female ? GIRL_STYLES[(i >> 1) % 3] : BOY_STYLES[(i >> 1) % 3],
      brow: 'worried',
      mouth: i % 3 === 0 ? 'open' : 'frown',
    });
  }

  // 一人称の右腕（学ランの袖と手）
  function fpArm() {
    const g = new THREE.Group();
    const p = new P();
    p.add(G.cap(0.042, 0.42), 0x181b24, [0, 0, 0], [Math.PI / 2, 0, 0]);
    p.add(G.cyl(0.046, 0.046, 0.03, true), 0x10121a, [0, 0, -0.24], [Math.PI / 2, 0, 0]);
    p.add(G.box(0.075, 0.03, 0.09), 0xeec3a0, [0, 0, -0.31]);
    for (let i = 0; i < 4; i++) p.add(G.cap(0.009, 0.045), 0xeec3a0, [-0.026 + i * 0.017, -0.012, -0.37], [Math.PI / 2 + 0.5, 0, 0]);
    p.add(G.cap(0.01, 0.035), 0xeec3a0, [-0.045, 0.004, -0.32], [Math.PI / 2, 0.6, 0]);
    g.add(new THREE.Mesh(p.build(), VC));
    return g;
  }

  Object.assign(MD, { human, pose, player, terrorist, girl, student, fpArm });
})();
