// 学校にテロリスト — 効果音とBGM（WebAudioで合成）
(function () {
  let ctx = null, master = null, bgmGain = null;
  let muted = false;
  try { muted = localStorage.getItem('tg-muted') === '1'; } catch (e) { /* 保存できなくても動く */ }
  let bgmMode = 'none', step = 0, nextT = 0, timer = null;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
    bgmGain = ctx.createGain();
    bgmGain.gain.value = 0.32;
    bgmGain.connect(master);
    timer = setInterval(schedule, 50);
  }

  function tone(freq, dur, type, vol, when, dest, slideTo) {
    if (!ctx) return;
    const t = when || ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, filterFreq, when) {
    if (!ctx) return;
    const t = when || ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq || 2000;
    const g = ctx.createGain(); g.gain.value = vol || 0.3;
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t);
  }

  const sfx = {
    alert() { // 例の「！」
      if (!ctx) return;
      const t = ctx.currentTime;
      [880, 1108, 1318].forEach((f) => tone(f, 0.5, 'sawtooth', 0.12, t));
      tone(440, 0.6, 'square', 0.1, t);
    },
    huh() { tone(520, 0.12, 'triangle', 0.15); tone(700, 0.18, 'triangle', 0.15, ctx && ctx.currentTime + 0.12); },
    shot() { noise(0.12, 0.35, 3000); tone(140, 0.1, 'square', 0.12, null, null, 60); },
    hit() { noise(0.15, 0.4, 900); tone(200, 0.2, 'sawtooth', 0.15, null, null, 80); },
    punch() { noise(0.08, 0.4, 1200); tone(160, 0.1, 'square', 0.15, null, null, 70); },
    takedown() { noise(0.2, 0.45, 700); tone(120, 0.3, 'square', 0.2, null, null, 50); },
    pickup() { if (!ctx) return; const t = ctx.currentTime; tone(660, 0.08, 'square', 0.12, t); tone(990, 0.12, 'square', 0.12, t + 0.08); },
    throw_() { noise(0.1, 0.15, 4000); },
    clack() { tone(1400, 0.05, 'square', 0.12); noise(0.05, 0.2, 5000); },
    spray() { noise(0.6, 0.35, 6000); },
    door() { noise(0.25, 0.25, 500); tone(90, 0.2, 'triangle', 0.15); },
    step() { noise(0.04, 0.08, 1500); },
    zap() { if (!ctx) return; for (let i = 0; i < 5; i++) tone(1800 + Math.random() * 800, 0.04, 'sawtooth', 0.08, ctx.currentTime + i * 0.035); },
    free() { if (!ctx) return; const t = ctx.currentTime; [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'square', 0.1, t + i * 0.09)); },
    clear() { if (!ctx) return; const t = ctx.currentTime; [392, 523, 659, 784, 659, 1046].forEach((f, i) => tone(f, 0.3, 'square', 0.1, t + i * 0.15)); },
    over() { if (!ctx) return; const t = ctx.currentTime; [392, 349, 311, 262].forEach((f, i) => tone(f, 0.45, 'sawtooth', 0.1, t + i * 0.3)); },
    text() { tone(1200, 0.025, 'square', 0.04); },
  };

  // 簡易シーケンサ
  const PAT = {
    sneak: { bpm: 84, bass: [55, 0, 0, 55, 0, 0, 65.4, 0, 55, 0, 0, 55, 0, 0, 49, 0], lead: [0, 0, 0, 0, 220, 0, 0, 0, 0, 0, 0, 0, 207.6, 0, 0, 0], vol: 0.9 },
    alert: { bpm: 168, bass: [73.4, 73.4, 146.8, 73.4, 77.8, 77.8, 155.6, 77.8, 73.4, 73.4, 146.8, 73.4, 69.3, 69.3, 138.6, 69.3], lead: [587, 0, 622, 0, 587, 0, 554, 0, 587, 0, 622, 0, 698, 0, 659, 0], vol: 1 },
    evasion: { bpm: 120, bass: [61.7, 0, 61.7, 0, 65.4, 0, 65.4, 0, 61.7, 0, 61.7, 0, 58.3, 0, 58.3, 0], lead: [0, 0, 370, 0, 0, 0, 392, 0, 0, 0, 370, 0, 0, 0, 349, 0], vol: 0.9 },
  };
  function schedule() {
    if (!ctx || bgmMode === 'none') return;
    const p = PAT[bgmMode];
    const stepDur = 60 / p.bpm / 2;
    if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
    while (nextT < ctx.currentTime + 0.2) {
      const i = step % 16;
      if (p.bass[i]) tone(p.bass[i], stepDur * 1.6, 'triangle', 0.5 * p.vol, nextT, bgmGain);
      if (p.lead[i]) tone(p.lead[i], stepDur * 1.4, 'square', 0.09 * p.vol, nextT, bgmGain);
      if (bgmMode === 'alert' && i % 2 === 0) {
        // ハイハット風
        const len = Math.floor(ctx.sampleRate * 0.03);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / len);
        const s = ctx.createBufferSource(); s.buffer = buf;
        const g = ctx.createGain(); g.gain.value = 0.12;
        s.connect(g); g.connect(bgmGain); s.start(nextT);
      }
      nextT += stepDur;
      step++;
    }
  }
  function bgm(mode) {
    if (bgmMode === mode) return;
    bgmMode = mode;
    step = 0;
  }
  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('tg-muted', m ? '1' : '0'); } catch (e) { /* 無視 */ }
    if (master) master.gain.value = m ? 0 : 0.55;
  }

  TG.audio = { init, sfx, bgm, setMuted, isMuted: () => muted };
})();
