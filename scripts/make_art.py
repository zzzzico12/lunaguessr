"""Render the full-Moon artwork used for backgrounds and link previews.

The near side is projected orthographically from assets/moon_8k.jpg (the LRO WAC mosaic),
north up and east on the right, as seen from Earth.

Writes:
  assets/moon_disk.jpg  1200x1200 full Moon on black (menu and result backgrounds, share image)
  assets/og-image.png   1200x630 link preview for social sites
Requires Pillow and NumPy. Downloads the Chakra Petch font (SIL OFL) on first run.
Usage: python3 scripts/make_art.py   (run scripts/generate.py first)
"""
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
FONT_URL = "https://github.com/google/fonts/raw/main/ofl/chakrapetch/ChakraPetch-{}.ttf"
BG = (7, 9, 13)
Image.MAX_IMAGE_PIXELS = None


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    path = ASSETS / f"_ChakraPetch-{weight}.ttf"
    if not path.exists():
        subprocess.run(["curl", "-sL", "-o", str(path), FONT_URL.format(weight)], check=True)
    return ImageFont.truetype(str(path), size)


def moon_disk(size: int) -> Image.Image:
    """Orthographic near side, supersampled 2x. Alpha marks the disk."""
    tex = np.asarray(Image.open(ASSETS / "moon_8k.jpg").convert("L"), dtype=np.float32)
    th, tw = tex.shape
    n = size * 2
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
    x = (xs + 0.5) / n * 2 - 1
    y = 1 - (ys + 0.5) / n * 2
    r2 = x * x + y * y
    inside = r2 <= 1
    z = np.sqrt(np.clip(1 - r2, 0, 1))
    lat = np.arcsin(np.clip(y, -1, 1))
    lon = np.arctan2(x, z)
    u = ((lon / np.pi + 1) / 2 * tw).astype(np.int32) % tw
    v = np.clip(((0.5 - lat / np.pi) * th).astype(np.int32), 0, th - 1)
    val = tex[v, u]
    # Gentle contrast lift and a little limb darkening so the disk reads as a sphere.
    val = np.clip((val - 12) * 1.4, 0, 255)
    val = 255 * (val / 255) ** 0.8 * (0.78 + 0.22 * z)
    rgb = np.stack([val * 0.98, val * 0.99, val * 1.02], axis=-1)
    rgb = np.where(inside[..., None], rgb, np.array(BG, dtype=np.float32))
    img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).resize((size, size), Image.LANCZOS)
    alpha = Image.fromarray((inside * 255).astype(np.uint8)).resize((size, size), Image.LANCZOS)
    img.putalpha(alpha)
    return img


def og_image(disk: Image.Image) -> Image.Image:
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), BG)
    # Faint glow, then a big Moon rising off the right edge.
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse((560, -120, 1480, 800), fill=70)
    img.paste(Image.new("RGB", (W, H), (60, 80, 110)), (0, 0), glow.filter(ImageFilter.GaussianBlur(90)))
    d = disk.resize((820, 820), Image.LANCZOS)
    img.paste(d, (640, -95), d)
    # Darken toward the text side so the type stays readable.
    fade = Image.linear_gradient("L").rotate(90).resize((W, H))
    img = Image.composite(img, Image.new("RGB", (W, H), BG), fade.point(lambda p: min(255, int(p * 1.6))))

    icon = Image.open(ASSETS / "apple-touch-icon.png").convert("RGB").resize((84, 84), Image.LANCZOS)
    mask = Image.new("L", (84, 84), 0); ImageDraw.Draw(mask).ellipse((5, 5, 79, 79), fill=255)
    img.paste(icon, (72, 150), mask)
    dr = ImageDraw.Draw(img)
    title = font("SemiBold", 92)
    dr.text((176, 140), "Luna", font=title, fill=(201, 204, 211))
    dr.text((176 + dr.textlength("Luna", font=title), 140), "Guessr", font=title, fill=(143, 184, 230))
    sub = font("Medium", 34)
    dr.text((76, 290), "Where on the Moon was this photo taken?", font=sub, fill=(201, 204, 211))
    dr.text((76, 340), "Real LRO orbital images on a 3D Moon.", font=sub, fill=(125, 133, 150))
    dr.text((76, 520), "Daily Challenge  ·  Far Side  ·  Landing Sites", font=font("Medium", 26), fill=(143, 184, 230))
    return img


def main():
    disk = moon_disk(1200)
    flat = Image.new("RGB", disk.size, BG); flat.paste(disk, (0, 0), disk)
    flat.save(ASSETS / "moon_disk.jpg", quality=86, optimize=True)
    og_image(disk).save(ASSETS / "og-image.png", optimize=True)
    print("ok")


if __name__ == "__main__":
    main()
