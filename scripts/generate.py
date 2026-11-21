"""Generate the images and question data for LunaGuessr.

Writes:
  assets/moon_4k.jpg             globe texture, 4096x2048 (LRO WAC mosaic, equirectangular)
  assets/moon_8k.jpg             globe texture, 8192x4096 (stitched from two WMS requests)
  assets/elevation.png           LOLA elevation, 1440x720, 8-bit (range in ELEVATION_RANGE_KM)
  assets/questions/<id>.jpg       question photo
  assets/questions/<id>_wide.jpg  wide-view photo for the hint
  js/questions.js                 question data (ES module)

Files that already exist are not downloaded again. Delete one to regenerate it.
Requires Python 3, curl, Pillow and NumPy.
Usage: python3 scripts/generate.py
"""
import json
import math
import random
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
QDIR = ASSETS / "questions"
WMS = (
    "https://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/earth/moon_simp_cyl.map"
    "&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=LROC_WAC&STYLES="
    "&SRS=EPSG:4326&FORMAT=image/jpeg"
)
LDEM_URL = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_4.tif"
KM_PER_DEG = 1737.4 * math.pi / 180
PHOTO_PX = 720

# (id, sets, latitude, longitude east-positive, diameter km,
#  English name, Japanese name, English description, Japanese description)
# Keep the order: the photo offsets come from a seeded RNG, so appending is safe but reordering moves every photo.
FEATURES = [
    ("tycho", ["near"], -43.31, -11.36, 85, "Tycho", "ティコ",
     "A young crater, about 100 million years old, whose bright rays stretch across the full Moon.",
     "満月で全体に光条を伸ばす若いクレーター。約1億年前にできた。"),
    ("copernicus", ["near"], 9.62, -20.08, 96, "Copernicus", "コペルニクス",
     "The \"Monarch of the Moon\", with terraced walls and central peaks.",
     "雛壇状の内壁と中央丘をもつ「月のクレーターの王」。"),
    ("kepler", ["near"], 8.12, -38.01, 31, "Kepler", "ケプラー",
     "A small rayed crater in Oceanus Procellarum.",
     "嵐の大洋に浮かぶ小さな光条クレーター。"),
    ("aristarchus", ["near"], 23.73, -47.49, 40, "Aristarchus", "アリスタルコス",
     "The brightest crater on the Moon, next to the winding Vallis Schröteri.",
     "月面でいちばん明るいクレーター。近くにシュレーター谷がある。"),
    ("plato", ["near"], 51.62, -9.38, 101, "Plato", "プラトン",
     "Known for its flat, dark, lava-filled floor on the north shore of Mare Imbrium.",
     "溶岩で埋まった平らな暗い床が目印。雨の海の北岸。"),
    ("clavius", ["near"], -58.62, -14.73, 231, "Clavius", "クラビウス",
     "A huge crater with an arc of smaller craters across its floor.",
     "床に小クレーターが弧状に並ぶ巨大クレーター。"),
    ("ptolemaeus", ["near"], -9.16, -1.84, 153, "Ptolemaeus", "プトレマイオス",
     "An old walled plain with a smooth floor near the center of the near side.",
     "月面中央付近、平らな床をもつ古い城壁平原。"),
    ("alphonsus", ["near"], -13.39, -2.85, 108, "Alphonsus", "アルフォンスス",
     "Central peak and dark spots on the floor. Ranger 9 crashed here in 1965.",
     "中央丘と床の暗い斑点。1965年にレンジャー9号が衝突した。"),
    ("arzachel", ["near"], -18.26, -1.93, 97, "Arzachel", "アルザケル",
     "The southernmost of the Ptolemaeus trio, with a prominent central peak.",
     "プトレマイオス三兄弟の南端。中央丘が目立つ。"),
    ("gassendi", ["near"], -17.55, -39.96, 110, "Gassendi", "ガッサンディ",
     "On the north shore of Mare Humorum, its floor cracked by rilles.",
     "湿りの海の北岸。床に割れ目（リル）が走る。"),
    ("theophilus", ["near"], -11.45, 26.28, 98, "Theophilus", "テオフィルス",
     "On the northwest edge of Mare Nectaris, overlapping its neighbor Cyrillus.",
     "神酒の海の北西。重なり合うキリルスと並ぶ。"),
    ("langrenus", ["near"], -8.86, 61.04, 132, "Langrenus", "ラングレヌス",
     "A large crater on the eastern shore of Mare Fecunditatis, near the limb.",
     "豊かの海の東岸、東の縁近くの大型クレーター。"),
    ("petavius", ["near"], -25.39, 60.4, 177, "Petavius", "ペタビウス",
     "A large rille runs across its floor from the central peaks.",
     "床に中央丘から伸びる大きな割れ目がある。"),
    ("posidonius", ["near"], 31.88, 29.99, 95, "Posidonius", "ポシドニウス",
     "On the eastern shore of Mare Serenitatis, its floor laced with rilles.",
     "晴れの海の東岸。床にリルが入り組む。"),
    ("eratosthenes", ["near"], 14.47, -11.32, 58, "Eratosthenes", "エラトステネス",
     "Sits at the western end of the Montes Apenninus.",
     "アペニン山脈の西端に位置するクレーター。"),
    ("archimedes", ["near"], 29.72, -3.99, 81, "Archimedes", "アルキメデス",
     "A flat, lava-flooded crater in Mare Imbrium.",
     "雨の海の中、溶岩で埋まった平らな床のクレーター。"),
    ("iridum", ["near"], 44.1, -31.5, 236, "Sinus Iridum (Bay of Rainbows)", "虹の入江",
     "A semicircular bay off Mare Imbrium, ringed by the Montes Jura.",
     "雨の海の北西にある半円形の入江。ジュラ山脈に囲まれる。"),
    ("crisium", ["near"], 17.0, 59.1, 556, "Mare Crisium (Sea of Crises)", "危難の海",
     "An isolated oval mare near the eastern limb.",
     "東の縁近くの独立した楕円形の海。"),
    ("schickard", ["near"], -44.4, -54.6, 206, "Schickard", "シッカルト",
     "A huge crater near the southwest limb with a two-toned floor.",
     "南西の縁近く、床が明暗に塗り分けられた巨大クレーター。"),
    ("apollo11", ["near", "landing"], 0.674, 23.473, 40, "Apollo 11 landing site", "アポロ11号着陸地点",
     "Southwestern Mare Tranquillitatis, where humans first walked on the Moon in 1969.",
     "静かの海の南西部。1969年、人類が初めて降り立った場所。"),
    ("apollo15", ["near", "landing"], 26.13, 3.63, 45, "Apollo 15 landing site", "アポロ15号着陸地点",
     "At the foot of the Montes Apenninus, beside Hadley Rille.",
     "アペニン山脈のふもと、ハドレー谷のほとり。"),
    ("apollo17", ["near", "landing"], 20.19, 30.77, 45, "Apollo 17 landing site", "アポロ17号着陸地点",
     "The Taurus-Littrow valley, southeast of Mare Serenitatis. The last crewed landing, in 1972.",
     "晴れの海の南東、タウルス・リットロウ谷。1972年、最後の有人着陸。"),
    ("alpes", ["near"], 48.5, 3.2, 80, "Vallis Alpes (Alpine Valley)", "アルプス谷",
     "A valley about 166 km long that cuts straight through the Montes Alpes.",
     "アルプス山脈を一直線に切り裂く長さ約166kmの谷。"),
    ("recta", ["near"], -22.1, -7.8, 60, "Rupes Recta (Straight Wall)", "直線の壁",
     "A fault scarp about 110 km long in Mare Nubium.",
     "雲の海にある長さ約110kmの断層崖。"),
    ("albategnius", ["near"], -11.24, 4.01, 136, "Albategnius", "アルバテグニウス",
     "An old walled plain in the central highlands, with the crater Klein on its southwest rim.",
     "中央部高地の古い城壁平原。南西縁にクラインがある。"),
    ("grimaldi", ["near"], -5.2, -68.6, 172, "Grimaldi", "グリマルディ",
     "A basin near the western limb with one of the darkest floors on the Moon.",
     "西の縁近く、月面で最も暗い床をもつ盆地。"),
    ("proclus", ["near"], 16.1, 46.84, 28, "Proclus", "プロクルス",
     "West of Mare Crisium, with rays thrown out in a lopsided fan.",
     "危難の海の西。扇形に偏った光条をもつ。"),
    ("hadley_mons", ["near"], 26.5, 4.7, 25, "Mons Hadley", "ハドレー山",
     "A peak of the Montes Apenninus, about 4.5 km high.",
     "アペニン山脈の高峰、標高約4.5km。"),
    # ---- far side ----
    ("tsiolkovskiy", ["far"], -20.4, 129.1, 185, "Tsiolkovskiy", "ツィオルコフスキー",
     "A dark lava-filled floor around a bright central peak, rare on the far side.",
     "裏側では珍しい、溶岩で埋まった暗い床と明るい中央丘をもつクレーター。"),
    ("moscoviense", ["far"], 27.3, 147.9, 277, "Mare Moscoviense", "モスクワの海",
     "One of the few maria on the far side, named after Moscow.",
     "裏側にある数少ない海のひとつ。"),
    ("korolev", ["far"], -4.0, -157.4, 423, "Korolev", "コロリョフ",
     "A large double-ringed basin on the far side.",
     "裏側にある二重リングの大きな盆地。"),
    ("hertzsprung", ["far"], 2.6, -129.2, 570, "Hertzsprung", "ヘルツシュプルング",
     "A huge multi-ring basin west of Korolev.",
     "コロリョフの西にある巨大な多重リング盆地。"),
    ("daedalus", ["far"], -5.9, 179.4, 93, "Daedalus", "ダイダロス",
     "Near the center of the far side, often proposed as a quiet site for a radio telescope.",
     "裏側のほぼ中心。電波望遠鏡の候補地としてよく挙がる。"),
    ("vonkarman", ["far"], -44.8, 175.9, 186, "Von Kármán", "フォン・カルマン",
     "A flooded crater inside the South Pole–Aitken basin.",
     "南極エイトケン盆地の中にある、溶岩で埋まったクレーター。"),
    ("apollo_basin", ["far"], -36.1, -151.8, 524, "Apollo basin", "アポロ盆地",
     "A double-ringed basin named after the Apollo program, with dark mare patches.",
     "アポロ計画にちなむ二重リングの盆地。暗い溶岩の斑点がある。"),
    ("schrodinger", ["far"], -75.0, 132.4, 312, "Schrödinger", "シュレーディンガー",
     "A young impact basin near the south pole, with a long rille across its floor.",
     "南極近くの若い衝突盆地。床を長い割れ目が横切る。"),
    ("mendeleev", ["far"], 5.7, 140.9, 313, "Mendeleev", "メンデレーエフ",
     "A large walled plain with a chain of small craters across its floor.",
     "床に小クレーターの列が走る大きな城壁平原。"),
    ("gagarin", ["far"], -20.2, 149.2, 262, "Gagarin", "ガガーリン",
     "A large, heavily cratered walled plain named after the first human in space.",
     "人類初の宇宙飛行士にちなむ、クレーターだらけの城壁平原。"),
    ("ingenii", ["far"], -33.7, 163.5, 318, "Mare Ingenii", "賢者の海",
     "A small far-side mare known for its bright, swirling patterns.",
     "明るい渦模様（ルナー・スワール）で知られる裏側の小さな海。"),
    ("jackson", ["far"], 22.4, -163.1, 71, "Jackson", "ジャクソン",
     "A fresh rayed crater on the far side.",
     "裏側にある新しい光条クレーター。"),
    ("orientale", ["far"], -19.9, -94.7, 930, "Mare Orientale", "東の海",
     "A bullseye-shaped basin with three rings, on the western limb.",
     "西の縁にある三重リングの的のような盆地。"),
    ("giordano_bruno", ["far"], 35.9, 102.8, 22, "Giordano Bruno", "ジョルダーノ・ブルーノ",
     "One of the youngest large craters on the Moon, with bright rays.",
     "月で最も新しい部類の大きなクレーター。明るい光条をもつ。"),
    # ---- landing sites ----
    ("apollo12", ["landing"], -3.012, -23.422, 40, "Apollo 12 landing site", "アポロ12号着陸地点",
     "Oceanus Procellarum, next to the Surveyor 3 probe that landed two years earlier.",
     "嵐の大洋。2年前に着陸したサーベイヤー3号のすぐ近く。"),
    ("apollo14", ["landing"], -3.645, -17.471, 40, "Apollo 14 landing site", "アポロ14号着陸地点",
     "The Fra Mauro highlands, the target Apollo 13 never reached.",
     "フラ・マウロ高地。アポロ13号が行けなかった目的地。"),
    ("apollo16", ["landing"], -8.973, 15.5, 40, "Apollo 16 landing site", "アポロ16号着陸地点",
     "The Descartes highlands, the only Apollo landing in the central highlands.",
     "デカルト高地。アポロで唯一の中央高地への着陸。"),
    ("luna9", ["landing"], 7.08, -64.37, 40, "Luna 9 landing site", "ルナ9号着陸地点",
     "Western Oceanus Procellarum. The first soft landing on the Moon, in 1966.",
     "嵐の大洋の西部。1966年、世界初の月面軟着陸。"),
    ("luna17", ["landing"], 38.24, -35.0, 40, "Luna 17 / Lunokhod 1", "ルナ17号（ルノホート1号）",
     "Mare Imbrium. Delivered the first robotic rover to another world, in 1970.",
     "雨の海。1970年、初めての無人月面車を運んだ。"),
    ("surveyor1", ["landing"], -2.47, -43.34, 40, "Surveyor 1 landing site", "サーベイヤー1号着陸地点",
     "Oceanus Procellarum. The first US soft landing, in 1966.",
     "嵐の大洋。1966年、アメリカ初の月面軟着陸。"),
    ("change3", ["landing"], 44.12, -19.51, 40, "Chang'e 3 landing site", "嫦娥3号着陸地点",
     "Northern Mare Imbrium. China's first lunar landing, with the Yutu rover, in 2013.",
     "雨の海の北部。2013年、中国初の月面着陸。探査車「玉兎」を搭載。"),
    ("change4", ["landing"], -45.44, 177.59, 40, "Chang'e 4 landing site", "嫦娥4号着陸地点",
     "Von Kármán crater. The first landing on the far side of the Moon, in 2019.",
     "フォン・カルマン・クレーター。2019年、世界初の月の裏側への着陸。"),
    ("change5", ["landing"], 43.06, -51.92, 40, "Chang'e 5 landing site", "嫦娥5号着陸地点",
     "Near Mons Rümker in Oceanus Procellarum. Returned samples to Earth in 2020.",
     "嵐の大洋のリュムカー山付近。2020年にサンプルを地球に持ち帰った。"),
    ("chandrayaan3", ["landing"], -69.37, 32.32, 40, "Chandrayaan-3 landing site", "チャンドラヤーン3号着陸地点",
     "The south polar region. India's first lunar landing, in 2023.",
     "南極域。2023年、インド初の月面着陸。"),
    ("slim", ["landing"], -13.32, 25.25, 40, "SLIM landing site", "SLIM着陸地点",
     "Near Shioli crater. Japan's first lunar landing, in 2024, within about 10 m of its target.",
     "SHIOLIクレーター付近。2024年、日本初の月面着陸。目標から約10m以内のピンポイント着陸。"),
    ("blueghost1", ["landing"], 18.56, 61.81, 40, "Blue Ghost Mission 1 landing site", "ブルーゴースト1号着陸地点",
     "Mare Crisium. A commercial landing under NASA's CLPS program, in 2025.",
     "危難の海。2025年、NASAのCLPS計画による民間の着陸。"),
]

ELEVATION_RANGE_KM = None  # filled in by make_elevation()


def curl(url: str, path: Path) -> None:
    if path.exists() and path.stat().st_size > 5000:
        return
    subprocess.run(["curl", "-s", "-m", "300", "--retry", "3", "-o", str(path), url], check=True)


def wms(path: Path, bbox: str, width: int, height: int) -> None:
    curl(f"{WMS}&BBOX={bbox}&WIDTH={width}&HEIGHT={height}", path)


def crop(path: Path, clat: float, clon: float, km: float) -> None:
    dlat = km / KM_PER_DEG / 2
    dlon = dlat / math.cos(math.radians(clat))
    wms(path, f"{clon - dlon},{clat - dlat},{clon + dlon},{clat + dlat}", PHOTO_PX, PHOTO_PX)


def make_globe_textures() -> None:
    wms(ASSETS / "moon_4k.jpg", "-180,-90,180,90", 4096, 2048)
    out = ASSETS / "moon_8k.jpg"
    if out.exists():
        return
    # The server caps each request at 4096 px, so fetch the two hemispheres and stitch them.
    west, east = ASSETS / "_west.jpg", ASSETS / "_east.jpg"
    wms(west, "-180,-90,0,90", 4096, 4096)
    wms(east, "0,-90,180,90", 4096, 4096)
    img = Image.new("L", (8192, 4096))
    img.paste(Image.open(west).convert("L"), (0, 0))
    img.paste(Image.open(east).convert("L"), (4096, 0))
    img.save(out, quality=86, optimize=True)
    west.unlink()
    east.unlink()


def make_elevation() -> tuple[float, float]:
    tif = ASSETS / "_ldem_4.tif"
    curl(LDEM_URL, tif)
    dem = np.array(Image.open(tif), dtype=np.float32)  # km relative to a 1737.4 km sphere
    lo, hi = float(dem.min()), float(dem.max())
    out = ASSETS / "elevation.png"
    if not out.exists():
        Image.fromarray(np.round((dem - lo) / (hi - lo) * 255).astype(np.uint8)).save(out, optimize=True)
    tif.unlink()
    return round(lo, 3), round(hi, 3)


def main() -> None:
    QDIR.mkdir(parents=True, exist_ok=True)
    make_globe_textures()
    elev = make_elevation()

    random.seed(42)
    questions = []
    for fid, sets, lat, lon, diam, en, ja, desc_en, desc_ja in FEATURES:
        win = min(max(diam * 2.6, 140), 900)  # photo width in km
        # Shift the photo center away from the feature center. The answer is the photo center.
        ang = random.uniform(0, 2 * math.pi)
        r = random.uniform(0.05, 0.22) * win
        clat = lat + r * math.sin(ang) / KM_PER_DEG
        clon = lon + r * math.cos(ang) / KM_PER_DEG / math.cos(math.radians(lat))
        clon = (clon + 540) % 360 - 180
        crop(QDIR / f"{fid}.jpg", clat, clon, win)
        crop(QDIR / f"{fid}_wide.jpg", clat, clon, min(win * 3.2, 2400))
        questions.append(dict(
            id=fid, sets=sets, lat=round(clat, 3), lon=round(clon, 3), km=round(win),
            feature=dict(lat=lat, lon=lon, km=diam),
            name=dict(en=en, ja=ja), desc=dict(en=desc_en, ja=desc_ja),
        ))
        print(fid, flush=True)

    body = json.dumps(questions, ensure_ascii=False, indent=1)
    (ROOT / "js" / "questions.js").write_text(
        "// Generated by scripts/generate.py. Do not edit by hand.\n"
        f"export const ELEVATION_RANGE_KM = [{elev[0]}, {elev[1]}];\n"
        f"export const QUESTIONS = {body};\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
