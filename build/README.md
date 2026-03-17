# Build Resources

Place platform-specific icons here:

- `icon.icns` — macOS app icon (1024x1024)
- `icon.ico` — Windows app icon (256x256)
- `icons/` — Linux icons (16x16 to 512x512 PNGs)
- `icon.svg` — Source SVG for generating all formats

To generate icons from the SVG:
```bash
# macOS (requires iconutil)
# Convert SVG → PNG first, then use iconutil

# Windows (requires ImageMagick)
convert icon.svg -resize 256x256 icon.ico

# Linux
for size in 16 32 48 64 128 256 512; do
  convert icon.svg -resize ${size}x${size} icons/${size}x${size}.png
done
```
