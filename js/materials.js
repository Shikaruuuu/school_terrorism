// 〇〇にテロリスト — 手続き生成の質感（PBR）
// 画像ファイルを使わず、キャンバスで「色・凹凸（法線）・粗さ」のテクスチャを作る。
// 貼り方はワールド座標基準（床は上から、壁は横から投影）なので、伸びたり継ぎ目がずれたりしない。
window.TG = window.TG || {};
(function () {
  const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const SZ = isTouch ? 256 : 512; // テクスチャの大きさ（スマホは軽く）

  // 決まった種から乱数（毎回同じ模様になるように）
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
  function canvas(n) { const c = document.createElement('canvas'); c.width = c.height = n || SZ; return c; }

  // なめらかなノイズ：小さな乱数画像を拡大して重ねる
  function noise(ctx, n, seed, octaves, alpha, light) {
    const r = rng(seed);
    for (let o = 0; o < octaves; o++) {
      const cells = 4 << o;
      const sc = canvas(cells);
      const sx = sc.getContext('2d');
      const img = sx.createImageData(cells, cells);
      for (let i = 0; i < cells * cells; i++) {
        const v = Math.floor(r() * 255);
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = light ? 255 : 0;
        img.data[i * 4 + 3] = v;
      }
      sx.putImageData(img, 0, 0);
      ctx.globalAlpha = alpha / (o + 1);
      ctx.imageSmoothingEnabled = true;
      // 継ぎ目が出ないよう、ずらして9枚並べる
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) ctx.drawImage(sc, dx * n, dy * n, n, n);
    }
    ctx.globalAlpha = 1;
  }
  // 細かい粒
  function speckle(ctx, n, seed, count, colors, size) {
    const r = rng(seed);
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = colors[Math.floor(r() * colors.length)];
      const s = (size || 1.5) * (0.5 + r());
      ctx.fillRect(r() * n, r() * n, s, s);
    }
  }
  // 明るさ（高さ）から法線マップを作る
  function normalFrom(src, strength) {
    const n = src.width;
    const d = src.getContext('2d').getImageData(0, 0, n, n).data;
    const out = canvas(n);
    const ox = out.getContext('2d');
    const img = ox.createImageData(n, n);
    const h = (x, y) => d[(((y + n) % n) * n + ((x + n) % n)) * 4] / 255;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength, dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * n + x) * 4;
      img.data[i] = (-dx / len * 0.5 + 0.5) * 255;
      img.data[i + 1] = (dy / len * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
    ox.putImageData(img, 0, 0);
    return out;
  }
  function tex(c, srgb) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = isTouch ? 2 : 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // ---- ワールド座標で貼る ----
  // scale：1mあたりのテクスチャの繰り返し数
  function worldUV(m, scale) {
    m.userData.uvScale = { value: scale };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uvScale = m.userData.uvScale;
      sh.vertexShader = 'uniform float uvScale;\n' + sh.vertexShader.replace('#include <project_vertex>', [
        '#include <project_vertex>',
        'vec4 wP = vec4(transformed, 1.0);',
        'vec3 wN = objectNormal;',
        '#ifdef USE_INSTANCING',
        '  wP = instanceMatrix * wP; wN = mat3(instanceMatrix) * wN;',
        '#endif',
        'wP = modelMatrix * wP; wN = abs(normalize(mat3(modelMatrix) * wN));',
        'vec2 wUv = (wN.y > 0.6 ? wP.xz : (wN.x > wN.z ? wP.zy : wP.xy)) * uvScale;',
        '#ifdef USE_MAP',
        '  vMapUv = wUv;',
        '#endif',
        '#ifdef USE_NORMALMAP',
        '  vNormalMapUv = wUv;',
        '#endif',
        '#ifdef USE_ROUGHNESSMAP',
        '  vRoughnessMapUv = wUv;',
        '#endif',
      ].join('\n'));
    };
    m.customProgramCacheKey = () => 'wuv';
    return m;
  }

  // ---- 個々の質感の絵 ----
  const PAINT = {
    // 塗り壁（しっくい）：少しまだらで、細かい凹凸
    plaster(x, n) {
      x.fillStyle = '#d8d2c2'; x.fillRect(0, 0, n, n);
      noise(x, n, 11, 4, 0.18, false);
      noise(x, n, 12, 3, 0.1, true);
      speckle(x, n, 13, n * 6, ['rgba(0,0,0,.05)', 'rgba(255,255,255,.08)'], 1.2);
    },
    // 廊下のリノリウム：1mごとの継ぎ目、まだら、すり傷
    lino(x, n) {
      x.fillStyle = '#8c9592'; x.fillRect(0, 0, n, n);
      noise(x, n, 21, 4, 0.22, false);
      speckle(x, n, 22, n * 10, ['rgba(255,255,255,.12)', 'rgba(0,0,0,.12)', 'rgba(120,140,135,.3)'], 1.6);
      const r = rng(23);
      x.strokeStyle = 'rgba(255,255,255,.05)'; x.lineWidth = 1;
      for (let i = 0; i < 40; i++) { x.beginPath(); const a = r() * n, b = r() * n; x.moveTo(a, b); x.lineTo(a + (r() - 0.5) * 80, b + (r() - 0.5) * 20); x.stroke(); }
      x.strokeStyle = 'rgba(30,35,34,.55)'; x.lineWidth = 2;
      [0, n / 2].forEach((p) => { x.beginPath(); x.moveTo(p, 0); x.lineTo(p, n); x.moveTo(0, p); x.lineTo(n, p); x.stroke(); });
    },
    // 教室の木の床：細い板を、色と継ぎ目を少しずつ変えて並べる
    wood(x, n) {
      const r = rng(31), rows = 8, rh = n / rows;
      for (let i = 0; i < rows; i++) {
        let px = -r() * n;
        while (px < n) {
          const len = n * (0.35 + r() * 0.5), tone = 0.82 + r() * 0.3;
          x.fillStyle = 'rgb(' + Math.floor(168 * tone) + ',' + Math.floor(118 * tone) + ',' + Math.floor(72 * tone) + ')';
          x.fillRect(px, i * rh, len, rh);
          // 木目
          x.strokeStyle = 'rgba(70,40,20,.18)'; x.lineWidth = 1;
          for (let k = 0; k < 4; k++) { x.beginPath(); const yy = i * rh + r() * rh; x.moveTo(px, yy); x.bezierCurveTo(px + len * 0.3, yy + (r() - 0.5) * 6, px + len * 0.7, yy + (r() - 0.5) * 6, px + len, yy); x.stroke(); }
          x.fillStyle = 'rgba(40,22,10,.6)'; x.fillRect(px, i * rh, 1.5, rh);
          px += len;
        }
        x.fillStyle = 'rgba(30,16,8,.55)'; x.fillRect(0, i * rh, n, 1.5);
      }
      noise(x, n, 32, 3, 0.12, false);
    },
    // 白いタイル（保健室・理科室）
    tile(x, n) {
      x.fillStyle = '#d9ddd8'; x.fillRect(0, 0, n, n);
      noise(x, n, 41, 3, 0.1, false);
      const k = n / 4;
      x.strokeStyle = 'rgba(70,75,72,.6)'; x.lineWidth = 3;
      for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * k, 0); x.lineTo(i * k, n); x.moveTo(0, i * k); x.lineTo(n, i * k); x.stroke(); }
    },
    // 天井の化粧板：穴の点々と目地
    ceil(x, n) {
      x.fillStyle = '#e4e1d8'; x.fillRect(0, 0, n, n);
      speckle(x, n, 51, n * 14, ['rgba(80,80,70,.28)'], 1.3);
      x.strokeStyle = 'rgba(90,90,80,.5)'; x.lineWidth = 2;
      x.strokeRect(0, 0, n / 2, n / 2); x.strokeRect(n / 2, 0, n / 2, n / 2); x.strokeRect(0, n / 2, n / 2, n / 2); x.strokeRect(n / 2, n / 2, n / 2, n / 2);
    },
    // コンクリート
    concrete(x, n) {
      x.fillStyle = '#8d8e8a'; x.fillRect(0, 0, n, n);
      noise(x, n, 61, 5, 0.3, false);
      noise(x, n, 62, 3, 0.12, true);
      speckle(x, n, 63, n * 8, ['rgba(0,0,0,.18)', 'rgba(255,255,255,.1)'], 1.4);
    },
    // 校庭の土
    dirt(x, n) {
      x.fillStyle = '#a58c66'; x.fillRect(0, 0, n, n);
      noise(x, n, 71, 5, 0.3, false);
      speckle(x, n, 72, n * 12, ['rgba(80,60,40,.35)', 'rgba(230,210,170,.3)', 'rgba(120,100,80,.4)'], 2);
    },
    // 芝生・草
    grass(x, n) {
      x.fillStyle = '#4a6a34'; x.fillRect(0, 0, n, n);
      noise(x, n, 81, 5, 0.35, false);
      const r = rng(82);
      for (let i = 0; i < n * 18; i++) {
        x.strokeStyle = r() < 0.5 ? 'rgba(120,160,70,.4)' : 'rgba(30,50,20,.4)';
        x.lineWidth = 1;
        const a = r() * n, b = r() * n;
        x.beginPath(); x.moveTo(a, b); x.lineTo(a + (r() - 0.5) * 3, b - 3 - r() * 5); x.stroke();
      }
    },
    // アスファルト
    asphalt(x, n) {
      x.fillStyle = '#3a3c3e'; x.fillRect(0, 0, n, n);
      noise(x, n, 91, 5, 0.25, false);
      speckle(x, n, 92, n * 20, ['rgba(255,255,255,.12)', 'rgba(0,0,0,.3)'], 1.6);
    },
    // 塗装した金属（ロッカー）：縦の通気口
    locker(x, n) {
      x.fillStyle = '#7f93a6'; x.fillRect(0, 0, n, n);
      noise(x, n, 101, 3, 0.1, false);
      x.fillStyle = 'rgba(20,28,36,.6)';
      for (let i = 0; i < 6; i++) x.fillRect(n * 0.3, n * 0.08 + i * n * 0.035, n * 0.4, n * 0.012);
      x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(0, 0, n, n * 0.01);
    },
    // 机の天板（明るい合板）
    deskwood(x, n) {
      x.fillStyle = '#c99b62'; x.fillRect(0, 0, n, n);
      x.strokeStyle = 'rgba(110,70,30,.2)'; x.lineWidth = 1.2;
      const r = rng(111);
      for (let i = 0; i < 60; i++) { x.beginPath(); const yy = r() * n; x.moveTo(0, yy); x.bezierCurveTo(n * 0.3, yy + (r() - 0.5) * 10, n * 0.6, yy + (r() - 0.5) * 10, n, yy); x.stroke(); }
      noise(x, n, 112, 3, 0.08, false);
    },
    // 黒板
    chalk(x, n) {
      x.fillStyle = '#23402f'; x.fillRect(0, 0, n, n);
      noise(x, n, 121, 4, 0.18, true);
      noise(x, n, 122, 3, 0.2, false);
    },
    // 体育マット
    mat(x, n) {
      x.fillStyle = '#3d6b9a'; x.fillRect(0, 0, n, n);
      noise(x, n, 131, 3, 0.15, false);
      x.strokeStyle = 'rgba(20,30,50,.4)'; x.lineWidth = 2;
      for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(0, i * n / 8); x.lineTo(n, i * n / 8); x.stroke(); }
    },
    // モールの床（磨いたテラゾー）
    terrazzo(x, n) {
      x.fillStyle = '#dcd6cb'; x.fillRect(0, 0, n, n);
      noise(x, n, 141, 3, 0.08, false);
      speckle(x, n, 142, n * 24, ['rgba(90,80,70,.5)', 'rgba(255,255,255,.6)', 'rgba(160,140,120,.5)', 'rgba(40,40,40,.4)'], 2.2);
      x.strokeStyle = 'rgba(120,110,100,.45)'; x.lineWidth = 2;
      x.strokeRect(1, 1, n - 2, n - 2);
    },
    // ブラシ仕上げの金属
    brushed(x, n) {
      x.fillStyle = '#9aa1a8'; x.fillRect(0, 0, n, n);
      const r = rng(151);
      for (let i = 0; i < n * 2; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)'; x.fillRect(0, r() * n, n, 1); }
    },
    // 布（ソファ・カーテン）
    fabric(x, n) {
      x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, n, n);
      for (let i = 0; i < n; i += 2) { x.fillStyle = i % 4 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.08)'; x.fillRect(0, i, n, 1); x.fillRect(i, 0, 1, n); }
      noise(x, n, 161, 3, 0.1, false);
    },
  };
  // 法線の強さと、粗さ（つやの無さ）
  const SPEC = {
    plaster: { normal: 1.5, rough: 0.92, scale: 0.5 },
    lino: { normal: 1.2, rough: 0.45, scale: 0.5, nScale: 0.4 },
    wood: { normal: 2.2, rough: 0.5, scale: 0.4 },
    tile: { normal: 2.5, rough: 0.3, scale: 0.75, nScale: 0.5 },
    ceil: { normal: 1.5, rough: 0.95, scale: 0.5 },
    concrete: { normal: 2.5, rough: 0.95, scale: 0.35 },
    dirt: { normal: 3, rough: 1, scale: 0.3 },
    grass: { normal: 3, rough: 0.95, scale: 0.4 },
    asphalt: { normal: 2.5, rough: 0.9, scale: 0.25 },
    locker: { normal: 2, rough: 0.45, metal: 0.4, scale: 0.5 },
    deskwood: { normal: 1.2, rough: 0.45, scale: 0.8 },
    chalk: { normal: 0.6, rough: 0.95, scale: 0.4 },
    mat: { normal: 1.5, rough: 0.8, scale: 0.5 },
    terrazzo: { normal: 0.5, rough: 0.26, scale: 0.5, nScale: 0.25 },
    brushed: { normal: 0.6, rough: 0.35, metal: 0.9, scale: 1 },
    fabric: { normal: 2.5, rough: 0.95, scale: 2 },
  };

  const maps = {};
  function mapsFor(kind) {
    if (maps[kind]) return maps[kind];
    const c = canvas();
    PAINT[kind](c.getContext('2d'), c.width);
    maps[kind] = { map: tex(c, true), normalMap: tex(normalFrom(c, SPEC[kind].normal)) };
    return maps[kind];
  }

  // 質感：kind（上の一覧）、color（掛け合わせる色）、opts（MeshStandardMaterial の追加設定）
  const cache = {};
  function surface(kind, color, opts) {
    const key = kind + '|' + (color == null ? '' : color) + '|' + JSON.stringify(opts || {});
    if (cache[key]) return cache[key];
    const sp = SPEC[kind], mp = mapsFor(kind);
    const o2 = Object.assign({}, opts || {});
    const uvs = o2.uvScale || sp.scale;
    delete o2.uvScale;
    const m = new THREE.MeshStandardMaterial(Object.assign({
      map: mp.map, normalMap: mp.normalMap, roughness: sp.rough, metalness: sp.metal || 0,
      color: color == null ? 0xffffff : color,
    }, o2));
    m.normalScale.setScalar(sp.nScale || 0.8);
    worldUV(m, uvs);
    cache[key] = m;
    return m;
  }
  // 模様なしの質感（小物用）
  function plain(color, rough, metal, opts) {
    const key = 'plain|' + color + '|' + rough + '|' + metal + '|' + JSON.stringify(opts || {});
    if (!cache[key]) cache[key] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough == null ? 0.7 : rough, metalness: metal || 0 }, opts || {}));
    return cache[key];
  }
  // 光る面（蛍光灯・看板・非常口の表示など）。ブルームでにじむように明るめに
  function glow(color, k) {
    const key = 'glow|' + color + '|' + k;
    if (!cache[key]) cache[key] = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k || 3), toneMapped: false });
    return cache[key];
  }
  // ガラス
  function glass(color, opacity) {
    const key = 'glass|' + color + '|' + opacity;
    if (!cache[key]) cache[key] = new THREE.MeshStandardMaterial({ color: color || 0xbfd8e6, roughness: 0.05, metalness: 0.1, transparent: true, opacity: opacity || 0.22, depthWrite: false, envMapIntensity: 1.6 });
    return cache[key];
  }

  // ---------- 形をまとめる（同じ材質の部品を1つの形にして描画回数を減らす） ----------
  const V = new THREE.Vector3(), Qt = new THREE.Quaternion(), E = new THREE.Euler(), S3 = new THREE.Vector3();
  function merge(items) {
    const parts = items.map(([g, p, r, s]) => {
      const geo = (g.index ? g.toNonIndexed() : g.clone());
      const m = new THREE.Matrix4().compose(V.set(p[0], p[1], p[2]), Qt.setFromEuler(E.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0)), S3.set(s ? s[0] : 1, s ? s[1] : 1, s ? s[2] : 1));
      geo.applyMatrix4(m);
      return geo;
    });
    let n = 0;
    parts.forEach((g) => { n += g.attributes.position.count; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let o = 0;
    parts.forEach((g) => {
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      o += g.attributes.position.count;
      g.dispose();
    });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.computeBoundingSphere();
    return out;
  }
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const CY = (r1, r2, h, n) => new THREE.CylinderGeometry(r1, r2, h, n || 16);

  // 同じ形をたくさん並べる。place(o, c) で位置・向きを決め、色を返すと個別の色になる
  const col = new THREE.Color();
  function inst(group, geo, material, list, place, shadow) {
    if (!list || !list.length) return null;
    const mesh = new THREE.InstancedMesh(geo, material, list.length);
    const o = new THREE.Object3D();
    const colors = [];
    list.forEach((c, i) => {
      o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
      colors.push(place(o, c, i));
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    // 色を返したものが1つでもあれば、返さなかったものは白（材質の色のまま）にする
    if (colors.some((c) => c !== undefined)) colors.forEach((c, i) => mesh.setColorAt(i, col.set(c === undefined ? 0xffffff : c)));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = shadow !== 'receive' && shadow !== false;
    mesh.receiveShadow = shadow !== false;
    group.add(mesh);
    return mesh;
  }

  // ---------- 絵（看板・掲示物・時計など） ----------
  function cv(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  TG.mat = { surface, plain, glow, glass, worldUV, isTouch, merge, inst, cv, B, CY };
})();
