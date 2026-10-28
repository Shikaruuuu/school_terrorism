// 学校にテロリスト — 3Dモデル（プリミティブの組み合わせ）
(function () {
  const mats = {};
  function mat(c, opts) {
    const k = c + (opts ? JSON.stringify(opts) : '');
    if (!mats[k]) mats[k] = new THREE.MeshLambertMaterial(Object.assign({ color: c }, opts || {}));
    return mats[k];
  }
  const geos = {};
  function boxGeo(w, h, d) {
    const k = w + ',' + h + ',' + d;
    if (!geos[k]) geos[k] = new THREE.BoxGeometry(w, h, d);
    return geos[k];
  }
  function box(w, h, d, c, x, y, z) {
    const m = new THREE.Mesh(boxGeo(w, h, d), mat(c));
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }
  const sphereGeo = new THREE.SphereGeometry(1, 14, 10);
  function sphere(r, c, x, y, z, sx, sy, sz) {
    const m = new THREE.Mesh(sphereGeo, mat(c));
    m.position.set(x || 0, y || 0, z || 0);
    m.scale.set(r * (sx || 1), r * (sy || 1), r * (sz || 1));
    return m;
  }

  // ダンボール
  function cardboard() {
    const g = new THREE.Group();
    g.add(box(0.8, 0.72, 0.66, 0xb48a52, 0, 0.36, 0));
    g.add(box(0.81, 0.08, 0.2, 0xd8c08a, 0, 0.72, 0));
    g.add(box(0.3, 0.2, 0.01, 0x7a5a30, 0, 0.42, 0.335));
    return g;
  }

  // アイテムのモデル
  function item(type) {
    const g = new THREE.Group();
    if (type === 'chalk') {
      g.add(box(0.3, 0.12, 0.18, 0xf5f2e6, 0, 0.06, 0));
      g.add(box(0.06, 0.06, 0.2, 0xe5533c, -0.06, 0.15, 0));
      g.add(box(0.06, 0.06, 0.2, 0xf2d264, 0.06, 0.15, 0));
    } else if (type === 'ext') {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 12), mat(0xd42a20));
      c.position.y = 0.25; g.add(c);
      g.add(box(0.08, 0.08, 0.2, 0x222222, 0, 0.52, 0.06));
    } else if (type === 'med') {
      g.add(box(0.34, 0.22, 0.24, 0xf5f5f5, 0, 0.11, 0));
      g.add(box(0.2, 0.06, 0.02, 0xd42a20, 0, 0.12, 0.125));
      g.add(box(0.06, 0.18, 0.02, 0xd42a20, 0, 0.12, 0.125));
    } else if (type === 'key') {
      g.add(box(0.06, 0.04, 0.24, 0xf2c94c, 0, 0.1, 0));
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 16), mat(0xf2c94c));
      r.position.set(0, 0.1, -0.16); r.rotation.x = Math.PI / 2; g.add(r);
      g.add(box(0.06, 0.04, 0.06, 0xf2c94c, 0.04, 0.1, 0.1));
    } else if (type === 'box') {
      g.add(box(0.6, 0.12, 0.5, 0xb48a52, 0, 0.06, 0));
    } else if (type === 'tape') {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.05, 8, 16), mat(0xc9b48a));
      t.rotation.x = Math.PI / 2; t.position.y = 0.06; g.add(t);
    } else if (type === 'stun') {
      g.add(box(0.12, 0.08, 0.3, 0x222222, 0, 0.06, 0));
      g.add(box(0.1, 0.04, 0.06, 0x4aa8ff, 0, 0.11, 0.12));
    } else if (type === 'gun' || type === 'ammo') {
      g.add(box(0.06, 0.12, 0.28, 0x2a2a2a, 0, 0.12, 0));
      g.add(box(0.05, 0.14, 0.06, 0x2a2a2a, 0, 0.04, -0.08));
    }
    return g;
  }

  // ラベルスプライト（!、? など）
  const spriteCache = {};
  function labelTexture(text, color, size) {
    const k = text + color + size;
    if (spriteCache[k]) return spriteCache[k];
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    x.font = '900 ' + (size || 96) + 'px "Dela Gothic One", "Zen Kaku Gothic New", sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 14; x.strokeStyle = 'rgba(0,0,0,.85)';
    x.strokeText(text, 128, 66);
    x.fillStyle = color; x.fillText(text, 128, 66);
    const t = new THREE.CanvasTexture(c);
    spriteCache[k] = t;
    return t;
  }
  function label(text, color, size, scale) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(text, color, size), depthTest: false, transparent: true }));
    s.scale.set(1.2 * (scale || 1), 0.6 * (scale || 1), 1);
    s.renderOrder = 10;
    return s;
  }
  function setLabel(s, text, color, size) {
    s.material.map = labelTexture(text, color, size);
    s.material.needsUpdate = true;
  }

  // 人物（human・pose ほか）は characters.js で追加する
  TG.models = { mat, box, sphere, cardboard, item, label, setLabel };
})();
