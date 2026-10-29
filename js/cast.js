// 〇〇にテロリスト — 登場人物（会話の立ち絵）の定義
// 画像は assets/chars/<id>_<表情>.webp（縦3:4）。まだ画像がない人物・表情は、
// 人物ごとの色のシルエットカードで代わりに表示し、会話はそのまま進む。
// 会話の行では { who: 'teacher', face: 'panic', t: '…' } のように人物と表情を指定する。
window.TG = window.TG || {};
(function () {
  const faces = (id, list) => {
    const out = {};
    list.forEach((k) => { out[k] = 'assets/chars/' + id + '_' + k + '.webp'; });
    return out;
  };
  TG.CAST = {
    // ---- 学校 ----
    shiraishi: { name: '白石さん', color: '#ff8fb6', faces: faces('shiraishi', ['normal', 'scared', 'surprised', 'relief', 'smile', 'tears', 'close']) },
    teacher: { name: '先生', color: '#9fb8ff', faces: faces('teacher', ['serious', 'panic', 'relief']) },
    sato: { name: '佐藤くん', color: '#8fe0b0', faces: faces('sato', ['worried', 'serious', 'relief']) },
    classmate_girl: { name: '高橋さん', color: '#ffd27a', faces: faces('classmate_girl', ['worried', 'surprised', 'relief']) },
    // ---- ショッピングモール ----
    misaki: { name: '美咲', color: '#ffb48a', faces: faces('misaki', ['smile', 'surprised', 'scared', 'relief', 'joy']) },
    mall_woman: { name: '買い物客の女性', color: '#d9a8ff', faces: faces('mall_woman', ['worried', 'serious']) },
    mall_man: { name: '買い物客の男性', color: '#a8c8a0', faces: faces('mall_man', ['panic', 'serious']) },
    clerk: { name: '店員', color: '#7fe3c8', faces: faces('clerk', ['worried', 'serious']) },
    // ---- 共通 ----
    terrorist: { name: '覆面の男', color: '#ff6a5a', faces: faces('terrorist', ['intimidate', 'angry', 'sneer']) },
    leader: { name: 'リーダー', color: '#ff3b30', faces: faces('leader', ['intimidate', 'angry', 'sneer']) },
    police: { name: '警察官', color: '#6fa8ff', faces: faces('police', ['serious', 'relief', 'gentle']) },
  };
  // 敵の一言（両ステージ共通）。動きながら画面上部に短く出る
  TG.BARKS = {
    huh: ['……ん？ 今、何か音がしたな', '誰かいるのか？', 'おい、そこに誰かいるだろ'],
    spot: ['いたぞ！ 逃がすな！', '見つけたぞ！ 動くな！', 'こっちだ！ 逃げたやつがいるぞ！'],
    bossSpot: ['……ほう。ネズミが紛れ込んでいたか', '面白い。俺から逃げられると思うなよ'],
  };
  // 人物と表情から画像のパス（表情の指定がなければ最初の表情）
  TG.castImage = (who, face) => {
    const c = TG.CAST[who];
    if (!c) return null;
    return c.faces[face] || c.faces[Object.keys(c.faces)[0]];
  };
})();
