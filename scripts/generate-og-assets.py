#!/usr/bin/env python3
"""Generate share/chrome artwork from the site theme. Re-run any time the
identity changes:  python3 scripts/generate-og-assets.py

Outputs (all in public/, all committed):
  og-image.png        1200x630  link unfurls (Open Graph / Twitter cards)
  apple-touch-icon.png 180x180  iOS home-screen / tab icon

The card mirrors the hero: paper background, serif name with the nickname in
accent, tagline, domain, and the profile photo in a circle. Colours are the
exact theme tokens from src/styles/global.css.
"""
from PIL import Image, ImageDraw, ImageFont

BG = (250, 249, 245)
INK = (42, 37, 35)
MUTED = (111, 104, 98)
ACCENT = (194, 94, 56)
GEORGIA = "/System/Library/Fonts/Supplemental/Georgia.ttf"
GEORGIA_BOLD = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
HELVETICA = "/System/Library/Fonts/Helvetica.ttc"


def tracked(draw, xy, text, font, fill, tracking):
    """Draw text with manual letter-spacing (PIL has no tracking knob)."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking
    return x


def fit(font_path, size, text, max_width):
    probe = ImageFont.truetype(font_path, size)
    while probe.getlength(text) > max_width and size > 10:
        size -= 2
        probe = ImageFont.truetype(font_path, size)
    return probe


def og_image():
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # Photo in a circle on the right.
    photo = Image.open("src/assets/pfp-1.jpg").convert("RGB")
    side = min(photo.size)
    photo = photo.crop(
        ((photo.width - side) // 2, (photo.height - side) // 2,
         (photo.width + side) // 2, (photo.height + side) // 2)
    ).resize((380, 380), Image.LANCZOS)
    mask = Image.new("L", (380, 380), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, 380, 380), fill=255)
    img.paste(photo, (740, 125), mask)
    # Thin accent ring around the photo.
    ring = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse((740, 125, 1120, 505), outline=ACCENT + (255,), width=6)
    img = Image.alpha_composite(img.convert("RGBA"), ring).convert("RGB")
    d = ImageDraw.Draw(img)

    tracked(d, (80, 108), "PORTFOLIO", ImageFont.truetype(HELVETICA, 30), ACCENT, 6)

    name_font = fit(GEORGIA_BOLD, 96, "Abdurrahman Ar", 620)
    d.text((80, 160), "Abdurrahman Ar", font=name_font, fill=INK)
    d.text((80, 268), "Rafif", font=name_font, fill=ACCENT)

    tag_font = ImageFont.truetype(HELVETICA, 38)
    d.text((80, 400), "Fullstack Web Developer", font=tag_font, fill=MUTED)
    dom_font = ImageFont.truetype(HELVETICA, 38)
    d.text((80, 452), "rafifhardja.xyz", font=dom_font, fill=ACCENT)

    img.save("public/og-image.png")
    print("public/og-image.png", img.size)


def apple_touch_icon():
    photo = Image.open("src/assets/pfp-1.jpg").convert("RGB")
    side = min(photo.size)
    icon = photo.crop(
        ((photo.width - side) // 2, (photo.height - side) // 2,
         (photo.width + side) // 2, (photo.height + side) // 2)
    ).resize((180, 180), Image.LANCZOS)
    icon.save("public/apple-touch-icon.png")
    print("public/apple-touch-icon.png", icon.size)


og_image()
apple_touch_icon()
