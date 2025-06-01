from PIL import Image, ImageDraw, ImageFont
import os

# Banner size
WIDTH, HEIGHT = 1200, 400

# Colors
BLUE = (30, 64, 175)      # Modern blue
WHITE = (255, 255, 255)
GOLD = (255, 215, 0)
DARK_BLUE = (20, 40, 120)
RED = (220, 38, 38)
LIGHT_BLUE = (96, 165, 250)

# Create image
img = Image.new('RGB', (WIDTH, HEIGHT), color=BLUE)
draw = ImageDraw.Draw(img)

def get_font(size, bold=False):
    try:
        if os.name == 'nt':
            font_path = 'arialbd.ttf' if bold else 'arial.ttf'
        else:
            font_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
        return ImageFont.truetype(font_path, size)
    except:
        return ImageFont.load_default()

# Draw discount badge (circle with 50% OFF)
badge_radius = 90
badge_center = (150, 120)
draw.ellipse([
    (badge_center[0] - badge_radius, badge_center[1] - badge_radius),
    (badge_center[0] + badge_radius, badge_center[1] + badge_radius)
], fill=GOLD, outline=WHITE, width=6)

badge_text = "50%\nOFF"
badge_font = get_font(38, bold=True)
badge_bbox = draw.textbbox((0, 0), badge_text, font=badge_font)
badge_w = badge_bbox[2] - badge_bbox[0]
badge_h = badge_bbox[3] - badge_bbox[1]
badge_x = badge_center[0] - badge_w//2
badge_y = badge_center[1] - badge_h//2
# Center multi-line text
for i, line in enumerate(badge_text.split('\n')):
    line_bbox = draw.textbbox((0, 0), line, font=badge_font)
    line_w = line_bbox[2] - line_bbox[0]
    line_h = line_bbox[3] - line_bbox[1]
    draw.text((badge_center[0] - line_w//2, badge_y + i*line_h), line, font=badge_font, fill=RED)

# Draw a simple lab/test tube icon (rectangle + ellipse)
tube_x, tube_y = 320, 90
tube_w, tube_h = 40, 120
draw.rectangle([tube_x, tube_y, tube_x + tube_w, tube_y + tube_h], fill=WHITE, outline=LIGHT_BLUE, width=4)
draw.ellipse([tube_x, tube_y + tube_h - 30, tube_x + tube_w, tube_y + tube_h + 10], fill=LIGHT_BLUE, outline=WHITE, width=2)
draw.rectangle([tube_x, tube_y, tube_x + tube_w, tube_y + 20], fill=LIGHT_BLUE, outline=WHITE, width=2)

# Draw headline
headline = 'Up to 50% Discount on Lab Tests'
headline_font = get_font(54, bold=True)
headline_bbox = draw.textbbox((0, 0), headline, font=headline_font)
headline_w = headline_bbox[2] - headline_bbox[0]
headline_h = headline_bbox[3] - headline_bbox[1]
headline_x = 420
headline_y = 120

draw.text((headline_x, headline_y), headline, font=headline_font, fill=WHITE)

# Draw subtext/call-to-action
cta = 'For Members Only'
cta_font = get_font(38, bold=True)
cta_bbox = draw.textbbox((0, 0), cta, font=cta_font)
cta_w = cta_bbox[2] - cta_bbox[0]
cta_h = cta_bbox[3] - cta_bbox[1]
cta_x = 420
cta_y = headline_y + headline_h + 30
draw.text((cta_x, cta_y), cta, font=cta_font, fill=GOLD)

# Add a gold border at the bottom
border_height = 12
draw.rectangle([(0, HEIGHT - border_height), (WIDTH, HEIGHT)], fill=GOLD)

# Save image
img.save('discount_banner.png')
print('Banner saved as discount_banner.png') 