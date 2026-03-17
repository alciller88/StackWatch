#!/usr/bin/env node
/**
 * Generate all icon formats required by electron-builder from build/icon.svg.
 *
 * Outputs:
 *   build/icon.png           — 512x512 PNG (source for icns/ico)
 *   build/icons/{s}x{s}.png  — Linux icon sizes (16–512)
 *   build/icon.icns           — macOS icon
 *   build/icon.ico            — Windows icon
 *
 * Usage:  node scripts/generate-icons.js
 * Deps:   npm install sharp png2icons --save-dev
 */

const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const png2icons = require('png2icons')

const BUILD_DIR = path.join(__dirname, '..', 'build')
const ICONS_DIR = path.join(BUILD_DIR, 'icons')
const SVG_PATH = path.join(BUILD_DIR, 'icon.svg')

const SIZES = [16, 32, 48, 64, 128, 256, 512]

async function main() {
  // Ensure icons directory exists
  fs.mkdirSync(ICONS_DIR, { recursive: true })

  const svg = fs.readFileSync(SVG_PATH)

  // Generate PNGs at all sizes for Linux
  console.log('Generating Linux PNGs...')
  for (const size of SIZES) {
    const outPath = path.join(ICONS_DIR, `${size}x${size}.png`)
    await sharp(svg, { density: 300 })
      .resize(size, size)
      .png()
      .toFile(outPath)
    console.log(`  ${size}x${size}.png`)
  }

  // Copy 512x512 as build/icon.png (source for icns/ico)
  const icon512 = path.join(ICONS_DIR, '512x512.png')
  const iconPng = path.join(BUILD_DIR, 'icon.png')
  fs.copyFileSync(icon512, iconPng)
  console.log('  icon.png (512x512 copy)')

  // Read the 512x512 PNG buffer for icns/ico generation
  const pngBuffer = fs.readFileSync(iconPng)

  // Generate macOS .icns
  console.log('Generating macOS icon.icns...')
  const icns = png2icons.createICNS(pngBuffer, png2icons.BILINEAR, 0)
  if (icns) {
    fs.writeFileSync(path.join(BUILD_DIR, 'icon.icns'), icns)
    console.log('  icon.icns')
  } else {
    console.error('  ERROR: Failed to generate icon.icns')
    process.exit(1)
  }

  // Generate Windows .ico
  console.log('Generating Windows icon.ico...')
  const ico = png2icons.createICO(pngBuffer, png2icons.BILINEAR, 0, true)
  if (ico) {
    fs.writeFileSync(path.join(BUILD_DIR, 'icon.ico'), ico)
    console.log('  icon.ico')
  } else {
    console.error('  ERROR: Failed to generate icon.ico')
    process.exit(1)
  }

  console.log('\nAll icons generated successfully.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
