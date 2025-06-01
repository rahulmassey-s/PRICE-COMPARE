from PIL import Image, ImageDraw, ImageFont
import os

# Banner size
WIDTH, HEIGHT = 1200, 400

# Colors
BLUE = (30, 64, 175)      # Modern blue
WHITE = (255, 255, 255)
GOLD = (255, 215, 0)
DARK_BLUE = (20, 40, 120)

# Create image
img = Image.new('RGB', (WIDTH, HEIGHT), color=BLUE)
draw = ImageDraw.Draw(img)

# Load fonts (fallback to default if not found)
def get_font(size, bold=False):
    try:
        if os.name == 'nt':
            font_path = 'arialbd.ttf' if bold else 'arial.ttf'
        else:
            font_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
        return ImageFont.truetype(font_path, size)
    except:
        return ImageFont.load_default()

# Draw rupee icon (simple)
rupee_font = get_font(100, bold=True)
rupee_text = '₹'
rupee_x, rupee_y = 80, HEIGHT//2 - 60
draw.text((rupee_x, rupee_y), rupee_text, font=rupee_font, fill=GOLD)

# Draw headline
headline = '₹200 Membership'
headline_font = get_font(70, bold=True)
headline_bbox = draw.textbbox((0, 0), headline, font=headline_font)
headline_w = headline_bbox[2] - headline_bbox[0]
headline_h = headline_bbox[3] - headline_bbox[1]
headline_x = 200
headline_y = HEIGHT//2 - headline_h//2 - 30
draw.text((headline_x, headline_y), headline, font=headline_font, fill=WHITE)

# Draw call-to-action
cta = 'Join Now!'
cta_font = get_font(48, bold=True)
cta_bbox = draw.textbbox((0, 0), cta, font=cta_font)
cta_w = cta_bbox[2] - cta_bbox[0]
cta_h = cta_bbox[3] - cta_bbox[1]
cta_x = 200
cta_y = headline_y + headline_h + 30
draw.text((cta_x, cta_y), cta, font=cta_font, fill=GOLD)

# Optional: Add a gold border at the bottom
border_height = 12
draw.rectangle([(0, HEIGHT - border_height), (WIDTH, HEIGHT)], fill=GOLD)

# Save image
img.save('membership_banner.png')
print('Banner saved as membership_banner.png') 