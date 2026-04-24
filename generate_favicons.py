import sys
from PIL import Image

input_path = "/Users/radityac/.gemini/antigravity/brain/c6bfbe91-025c-4133-aeb0-2b90c76a2772/hydrosense_favicon_base_1776972808896.png"
output_dir = "/Users/radityac/Desktop/Hydroponic-main"

img = Image.open(input_path)
img = img.convert("RGBA")

# Generate sizes
sizes = {
    'favicon-16x16.png': 16,
    'favicon-32x32.png': 32,
    'apple-touch-icon.png': 180,
    'android-chrome-192x192.png': 192,
    'android-chrome-512x512.png': 512,
}

for filename, size in sizes.items():
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(f"{output_dir}/{filename}")

# Generate favicon.ico (contains 16x16 and 32x32)
img_16 = img.resize((16, 16), Image.Resampling.LANCZOS)
img_32 = img.resize((32, 32), Image.Resampling.LANCZOS)
img_32.save(f"{output_dir}/favicon.ico", format="ICO", sizes=[(32, 32), (16, 16)], append_images=[img_16])

print("Favicons generated successfully.")
