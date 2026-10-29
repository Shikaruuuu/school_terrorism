"""会話用の立ち絵を、ゲームで使う形（縦3:4・600×800・WebP）にそろえて assets/chars/ に保存する。

使い方:
    python3 tools/optimize_portraits.py <画像のフォルダ>

フォルダ内の PNG / JPG / WebP を読み、ファイル名（拡張子を除く）をそのまま使って
assets/chars/<名前>.webp に書き出す。縦横比が 3:4 でなければ、顔が切れにくいよう
上寄せで中央を切り出す。Pillow が必要（pip install pillow）。
"""
import sys
from pathlib import Path

from PIL import Image

W, H = 600, 800
OUT = Path(__file__).resolve().parent.parent / 'assets' / 'chars'


def fit(im):
    w, h = im.size
    if w / h > W / H:
        nw = round(h * W / H)
        x = (w - nw) // 2
        im = im.crop((x, 0, x + nw, h))
    elif w / h < W / H:
        nh = round(w * H / W)
        # 顔は上の方にあるので、上寄せで切る
        y = min((h - nh) // 4, h - nh)
        im = im.crop((0, y, w, y + nh))
    return im.resize((W, H), Image.LANCZOS)


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    src = Path(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    files = [p for p in sorted(src.iterdir()) if p.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp')]
    if not files:
        print('画像が見つかりません:', src)
        sys.exit(1)
    for p in files:
        im = fit(Image.open(p).convert('RGB'))
        dst = OUT / (p.stem + '.webp')
        im.save(dst, 'WEBP', quality=82, method=6)
        print(f'{p.name} -> {dst.relative_to(OUT.parent.parent)} ({dst.stat().st_size // 1024}KB)')


if __name__ == '__main__':
    main()
