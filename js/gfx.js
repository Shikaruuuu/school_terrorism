// 〇〇にテロリスト — 描画の仕上げ（画質・空・環境光・影・ポスト処理）
// ・シーンはHDRで描き、ブルーム（光のにじみ）→ トーンマップ（ACES）→ 色調補正 → ビネット → 粒子、の順で仕上げる
// ・影は1灯だけ。主人公のまわりだけを高い解像度で追いかける
// ・画質は「高・標準・軽量」の3段階。さらに重いときは自動で描画解像度を下げる（動的解像度）
window.TG = window.TG || {};
(function () {
  const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

  // 画質ごとの設定
  const QUALITY = {
    high: { name: '高', ratio: isTouch ? 1.6 : 2, shadow: 2048, post: true, msaa: 4, bloom: 1, grain: true, lights: 4 },
    mid: { name: '標準', ratio: isTouch ? 1.25 : 1.5, shadow: 1024, post: true, msaa: 0, bloom: 1, grain: false, lights: 3 },
    low: { name: '軽量', ratio: 1, shadow: 0, post: false, msaa: 0, bloom: 0, grain: false, lights: 0 },
  };
  const ORDER = ['high', 'mid', 'low'];

  let R = null, scene = null, camera = null;
  let Q = null, qName = 'mid', canPost = true;
  let W = 1, H = 1, dynScale = 1;
  let rtScene = null, rtA = null, rtB = null, rtC = null, rtD = null;
  let look = null;
  const fx = { alert: 0, danger: 0, dim: 0, flash: 0, flashColor: new THREE.Color(1, 1, 1), warm: 0 };
  const target = { alert: 0, danger: 0, dim: 0, warm: 0 };

  // ---------------- 光 ----------------
  const hemi = new THREE.HemisphereLight(0xffffff, 0x333333, 0.6);
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  const SH = 15; // 影を落とす範囲（主人公から±SH m）
  Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 80 });
  const sunDir = new THREE.Vector3(0.4, 1, 0.3).normalize();
  const focus = new THREE.Vector3();

  // ---------------- 照明器具の光（近くのものだけ本物の光にする） ----------------
  // ステージの照明器具の一覧から、主人公に近い数個にだけ点光源を割り当てる（光の数は画質で固定）
  const POOL_MAX = 4;
  const pool = [];
  for (let i = 0; i < POOL_MAX; i++) { const l = new THREE.PointLight(0xffffff, 0, 7, 2); pool.push(l); }
  let sources = [];
  function setLightSources(list) { sources = list || []; }
  function updatePool(x, y, z) {
    const n = Q ? Q.lights : 0;
    if (!n || !sources.length) { pool.forEach((l) => { l.intensity = 0; }); return; }
    // 近い順に n 個（高さの違う階のものは遠い扱い）
    const best = [];
    for (const s of sources) {
      if (s.off) continue;
      const d = (s.x - x) * (s.x - x) + (s.z - z) * (s.z - z) + (s.y - y - 2) * (s.y - y - 2) * 4;
      if (best.length < n) { best.push([d, s]); best.sort((a, b) => a[0] - b[0]); } else if (d < best[n - 1][0]) { best[n - 1] = [d, s]; best.sort((a, b) => a[0] - b[0]); }
    }
    pool.forEach((l, i) => {
      const b = i < n ? best[i] : null;
      if (!b) { l.intensity = 0; return; }
      const s = b[1];
      l.position.set(s.x, s.y, s.z);
      l.color.set(s.color);
      // 遠いものは弱めて、割り当てが変わるときに光がぱっと切り替わらないようにする
      const fade = Math.max(0, 1 - Math.sqrt(b[0]) / 14);
      l.intensity = s.intensity * fade * (s.flicker ? s.flicker() : 1);
      l.distance = s.distance || 7;
    });
  }

  // ---------------- 空 ----------------
  // 大きな球の内側に、縦のグラデーションと太陽のにじみを描く（フォグの影響を受けない）
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sunC: { value: new THREE.Color() }, sunD: { value: new THREE.Vector3(0, 1, 0) } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: [
      'uniform vec3 top, mid, bot, sunC, sunD; varying vec3 vD;',
      'void main(){',
      '  float h = vD.y;',
      '  vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h,0.0,1.0), 0.55)) : mix(mid, bot, clamp(-h*3.0,0.0,1.0));',
      '  float s = max(dot(vD, normalize(sunD)), 0.0);',
      '  c += sunC * (pow(s, 600.0) * 6.0 + pow(s, 12.0) * 0.6);',
      '  gl_FragColor = vec4(c, 1.0);',
      '}',
    ].join('\n'),
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(160, 32, 16), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;

  // ---------------- ポスト処理 ----------------
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fsScene = new THREE.Scene();
  const fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  fsQuad.frustumCulled = false;
  fsScene.add(fsQuad);
  const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

  // 明るい所だけを取り出して縮小（4点平均）
  const brightMat = new THREE.ShaderMaterial({
    uniforms: { t: { value: null }, texel: { value: new THREE.Vector2() }, thr: { value: 1 } },
    vertexShader: VS,
    fragmentShader: [
      'uniform sampler2D t; uniform vec2 texel; uniform float thr; varying vec2 vUv;',
      'void main(){',
      '  vec3 c = texture2D(t, vUv + texel*vec2(-1.,-1.)).rgb + texture2D(t, vUv + texel*vec2(1.,-1.)).rgb',
      '         + texture2D(t, vUv + texel*vec2(-1.,1.)).rgb + texture2D(t, vUv + texel*vec2(1.,1.)).rgb;',
      '  c *= 0.25;',
      '  float l = max(c.r, max(c.g, c.b));',
      '  float k = max(l - thr, 0.0) / max(l, 1e-4);',
      '  gl_FragColor = vec4(min(c * k, vec3(40.0)), 1.0);',
      '}',
    ].join('\n'),
  });
  // ガウスぼかし（線形補間を使った9タップ）
  const blurMat = new THREE.ShaderMaterial({
    uniforms: { t: { value: null }, dir: { value: new THREE.Vector2() } },
    vertexShader: VS,
    fragmentShader: [
      'uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;',
      'void main(){',
      '  vec3 c = texture2D(t, vUv).rgb * 0.227027;',
      '  c += texture2D(t, vUv + dir * 1.3846154).rgb * 0.3162162;',
      '  c += texture2D(t, vUv - dir * 1.3846154).rgb * 0.3162162;',
      '  c += texture2D(t, vUv + dir * 3.2307692).rgb * 0.0702703;',
      '  c += texture2D(t, vUv - dir * 3.2307692).rgb * 0.0702703;',
      '  gl_FragColor = vec4(c, 1.0);',
      '}',
    ].join('\n'),
  });
  const copyMat = new THREE.ShaderMaterial({
    uniforms: { t: { value: null } },
    vertexShader: VS,
    fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb, 1.0); }',
  });
  // 仕上げ：ブルーム合成 → 露出 → ACES → 色調補正 → ビネット・色収差・警戒/危険の色 → 粒子 → sRGB
  const finalMat = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: null }, tB1: { value: null }, tB2: { value: null },
      bloom: { value: 0.6 }, exposure: { value: 1 }, vignette: { value: 0.5 }, grain: { value: 0.03 }, time: { value: 0 },
      ca: { value: 0.0022 }, sat: { value: 1 }, lift: { value: new THREE.Vector3() }, gain: { value: new THREE.Vector3(1, 1, 1) }, tint: { value: new THREE.Vector3(1, 1, 1) },
      alert: { value: 0 }, danger: { value: 0 }, dim: { value: 0 }, flash: { value: 0 }, flashC: { value: new THREE.Color(1, 1, 1) }, warm: { value: 0 },
    },
    vertexShader: VS,
    fragmentShader: [
      'uniform sampler2D tScene, tB1, tB2; uniform float bloom, exposure, vignette, grain, time, ca, sat, alert, danger, dim, flash, warm;',
      'uniform vec3 lift, gain, tint, flashC; varying vec2 vUv;',
      'vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }',
      'float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }',
      'void main(){',
      '  vec2 d = vUv - 0.5; float r2 = dot(d, d);',
      '  float k = ca * (1.0 + alert * 2.0) * r2 * 4.0;',
      '  vec3 c = vec3(texture2D(tScene, vUv - d*k).r, texture2D(tScene, vUv).g, texture2D(tScene, vUv + d*k).b);',
      '  c += (texture2D(tB1, vUv).rgb * 0.8 + texture2D(tB2, vUv).rgb * 1.2) * bloom;',
      '  c *= exposure;',
      '  c = aces(c);',
      '  c = c * gain + lift * (1.0 - c);',
      '  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));',
      '  c = mix(vec3(l), c, sat * (1.0 - danger * 0.55) * (1.0 - dim * 0.4));',
      '  c *= tint;',
      '  c *= mix(vec3(1.0), vec3(1.08, 0.96, 0.86), warm);',
      '  float vig = smoothstep(0.08, 0.62, r2 * 1.7);',
      '  c *= 1.0 - vignette * vig - dim * 0.45;',
      '  vec3 red = vec3(1.0, 0.08, 0.05);',
      '  c = mix(c, red * (0.25 + l), clamp(alert * vig * 0.55 + danger * vig * 0.45, 0.0, 0.8));',
      '  c = mix(c, flashC, flash);',
      '  c += (rnd(vUv * 731.0 + time) - 0.5) * grain;',
      '  c = pow(max(c, 0.0), vec3(1.0 / 2.2));',
      '  gl_FragColor = vec4(c, 1.0);',
      '}',
    ].join('\n'),
  });

  function pass(mat, rt) {
    fsQuad.material = mat;
    R.setRenderTarget(rt);
    R.render(fsScene, fsCam);
  }

  function makeRT(w, h, samples) {
    const rt = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), { type: THREE.HalfFloatType, depthBuffer: !!samples || samples === 0, samples: samples || 0 });
    rt.texture.generateMipmaps = false;
    return rt;
  }
  function disposeRTs() { [rtScene, rtA, rtB, rtC, rtD].forEach((r) => r && r.dispose()); rtScene = rtA = rtB = rtC = rtD = null; }
  function buildRTs() {
    disposeRTs();
    if (!usePost()) return;
    const pr = R.getPixelRatio();
    const w = Math.round(W * pr), h = Math.round(H * pr);
    rtScene = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: Q.msaa && R.capabilities.isWebGL2 ? Q.msaa : 0 });
    rtScene.texture.generateMipmaps = false;
    rtA = makeRT(w >> 2, h >> 2); rtB = makeRT(w >> 2, h >> 2);
    rtC = makeRT(w >> 3, h >> 3); rtD = makeRT(w >> 3, h >> 3);
    [rtA, rtB, rtC, rtD].forEach((r) => { r.depthBuffer = false; });
  }
  const usePost = () => Q.post && canPost;

  function applyQuality() {
    R.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.ratio) * dynScale);
    R.shadowMap.enabled = Q.shadow > 0;
    R.shadowMap.type = THREE.PCFSoftShadowMap;
    sun.castShadow = Q.shadow > 0;
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    sun.shadow.mapSize.set(Q.shadow || 512, Q.shadow || 512);
    // ポスト処理を使わないときは、three.js のトーンマップで直接描く
    R.toneMapping = usePost() ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    R.toneMappingExposure = look ? look.exposure : 1;
    // 材質のシェーダーを作り直す（影の有無が変わるため）
    if (scene) scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    buildRTs();
  }

  // ---------------- 環境光（反射） ----------------
  // ステージの雰囲気に合わせた「光る板の部屋」を作り、PMREMで反射用の環境マップにする
  let pmrem = null, envTex = null;
  function makeEnv(e) {
    if (!pmrem) pmrem = new THREE.PMREMGenerator(R);
    const s = new THREE.Scene();
    const room = new THREE.Mesh(new THREE.BoxGeometry(30, 12, 30), new THREE.MeshBasicMaterial({ color: new THREE.Color(e.base), side: THREE.BackSide }));
    room.position.y = 4;
    s.add(room);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ color: new THREE.Color(e.floor) }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.9;
    s.add(floor);
    (e.panels || []).forEach(([x, y, z, w, h, d, c, k]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k || 1) }));
      m.position.set(x, y, z);
      s.add(m);
    });
    const tex = pmrem.fromScene(s, 0.03).texture;
    s.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    return tex;
  }

  // ---------------- 外から使う ----------------
  function init(renderer, sc, cam) {
    R = renderer; scene = sc; camera = cam;
    // 半精度浮動小数のレンダーターゲットが使えない端末では、ポスト処理を使わない
    canPost = R.capabilities.isWebGL2 || R.extensions.has('EXT_color_buffer_half_float');
    R.outputColorSpace = THREE.SRGBColorSpace;
    scene.add(hemi, sun, sun.target, sky);
    pool.forEach((l) => scene.add(l));
    let saved = null;
    try { saved = localStorage.getItem('tg-quality'); } catch (e) { /* 保存できない環境 */ }
    qName = QUALITY[saved] ? saved : isTouch ? 'mid' : 'high';
    Q = QUALITY[qName];
    applyQuality();
  }
  function setQuality(name) {
    if (!QUALITY[name]) return;
    qName = name; Q = QUALITY[name]; dynScale = 1;
    try { localStorage.setItem('tg-quality', name); } catch (e) { /* 保存できない環境 */ }
    applyQuality();
  }
  function cycleQuality() { setQuality(ORDER[(ORDER.indexOf(qName) + 1) % ORDER.length]); return Q.name; }

  // ステージの見た目（空・霧・光・反射・色調）
  function setLook(l) {
    look = l;
    skyMat.uniforms.top.value.set(l.sky[0]); skyMat.uniforms.mid.value.set(l.sky[1]); skyMat.uniforms.bot.value.set(l.sky[2]);
    skyMat.uniforms.sunC.value.set(l.sunGlow || 0x000000);
    sunDir.set(l.sunDir[0], l.sunDir[1], l.sunDir[2]).normalize();
    skyMat.uniforms.sunD.value.copy(sunDir);
    scene.background = null;
    scene.fog = new THREE.FogExp2(new THREE.Color(l.fog[0]), l.fog[1]);
    hemi.color.set(l.hemi[0]); hemi.groundColor.set(l.hemi[1]); hemi.intensity = l.hemi[2];
    sun.color.set(l.sun[0]); sun.intensity = l.sun[1];
    if (envTex) envTex.dispose();
    envTex = makeEnv(l.env);
    scene.environment = envTex;
    const u = finalMat.uniforms;
    u.bloom.value = l.bloom; u.exposure.value = l.exposure; u.vignette.value = l.vignette; u.sat.value = l.sat;
    u.lift.value.set(...l.lift); u.gain.value.set(...l.gain); u.tint.value.set(...l.tint);
    brightMat.uniforms.thr.value = l.bloomThr;
    R.toneMappingExposure = l.exposure;
    if (TG.rim) TG.rim.color.value.set(l.rim || 0x403a36);
  }

  // 影を主人公のまわりに合わせる（影の解像度1マス単位でそろえ、動いてもちらつかないようにする）
  function setFocus(x, y, z) {
    const tex = (SH * 2) / (Q.shadow || 512);
    focus.set(Math.round(x / tex) * tex, y, Math.round(z / tex) * tex);
    sun.target.position.copy(focus);
    sun.position.copy(focus).addScaledVector(sunDir, 40);
    sky.position.copy(camera.position);
    updatePool(x, y, z);
  }

  function resize(w, h) { W = w; H = h; R.setSize(w, h, false); buildRTs(); }

  // 重いときは描画解像度を下げ、余裕があれば戻す
  let ft = 1 / 60, slowT = 0, fastT = 0;
  function adapt(dt) {
    if (!dt) return;
    ft += (dt - ft) * 0.05;
    if (ft > 1 / 42) { slowT += dt; fastT = 0; } else if (ft < 1 / 56) { fastT += dt; slowT = 0; } else { slowT = fastT = 0; }
    if (slowT > 2 && dynScale > 0.6) { dynScale = Math.max(0.6, dynScale - 0.1); slowT = 0; applyRatio(); }
    if (fastT > 5 && dynScale < 1) { dynScale = Math.min(1, dynScale + 0.1); fastT = 0; applyRatio(); }
  }
  function applyRatio() { R.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.ratio) * dynScale); R.setSize(W, H, false); buildRTs(); }

  const sceneInfo = { calls: 0, tris: 0 };
  function render(dt, t) {
    adapt(dt);
    // 演出の値をなめらかに追いかける
    const ease = (k, sp) => { fx[k] += (target[k] - fx[k]) * Math.min(1, dt * sp); };
    ease('alert', 3); ease('danger', 2); ease('dim', 5); ease('warm', 1.5);
    fx.flash = Math.max(0, fx.flash - dt * 2.2);
    if (!usePost()) {
      R.setRenderTarget(null);
      R.render(scene, camera);
      return;
    }
    R.setRenderTarget(rtScene);
    R.render(scene, camera);
    sceneInfo.calls = R.info.render.calls; sceneInfo.tris = R.info.render.triangles;
    const sw = rtScene.width, sh = rtScene.height;
    if (Q.bloom && look && look.bloom > 0) {
      brightMat.uniforms.t.value = rtScene.texture;
      brightMat.uniforms.texel.value.set(1 / sw, 1 / sh);
      pass(brightMat, rtA);
      blurMat.uniforms.t.value = rtA.texture; blurMat.uniforms.dir.value.set(1 / rtA.width, 0); pass(blurMat, rtB);
      blurMat.uniforms.t.value = rtB.texture; blurMat.uniforms.dir.value.set(0, 1 / rtA.height); pass(blurMat, rtA);
      copyMat.uniforms.t.value = rtA.texture; pass(copyMat, rtC);
      blurMat.uniforms.t.value = rtC.texture; blurMat.uniforms.dir.value.set(1.5 / rtC.width, 0); pass(blurMat, rtD);
      blurMat.uniforms.t.value = rtD.texture; blurMat.uniforms.dir.value.set(0, 1.5 / rtC.height); pass(blurMat, rtC);
    }
    const u = finalMat.uniforms;
    u.tScene.value = rtScene.texture; u.tB1.value = rtA.texture; u.tB2.value = rtC.texture;
    u.bloom.value = Q.bloom && look ? look.bloom : 0;
    u.grain.value = Q.grain ? 0.016 : 0.0;
    u.time.value = (t || 0) % 100;
    u.alert.value = fx.alert; u.danger.value = fx.danger; u.dim.value = fx.dim; u.warm.value = fx.warm;
    u.flash.value = fx.flash; u.flashC.value.copy(fx.flashColor);
    pass(finalMat, null);
  }

  // 一瞬の光（見つかった・再会など）
  function flash(color, k) { fx.flashColor.set(color); fx.flash = Math.max(fx.flash, k == null ? 0.6 : k); }

  TG.gfx = {
    init, setLook, setFocus, setLightSources, setQuality, cycleQuality, resize, render, flash,
    get quality() { return qName; }, get qualityLabel() { return Q.name; }, get shadows() { return Q.shadow > 0; },
    fx: target, sun, hemi, get _renderer() { return R; }, sceneInfo,
  };
})();
