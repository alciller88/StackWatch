#!/usr/bin/env node

/**
 * Validates the production build output to catch common issues
 * before distribution. Run after `npm run build:prod`.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
let errors = 0
let warnings = 0

function check(condition, message, severity = 'error') {
  if (!condition) {
    if (severity === 'error') {
      console.error(`  ✕ ${message}`)
      errors++
    } else {
      console.warn(`  ⚠ ${message}`)
      warnings++
    }
  } else {
    console.log(`  ✓ ${message}`)
  }
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath))
}

function fileSize(relativePath) {
  try {
    return fs.statSync(path.join(ROOT, relativePath)).size
  } catch {
    return 0
  }
}

function dirContains(dir, pattern) {
  try {
    const files = fs.readdirSync(path.join(ROOT, dir))
    return files.some(f => f.match(pattern))
  } catch {
    return false
  }
}

console.log('\n  STACKWATCH BUILD VALIDATION\n')

// 1. Vite output
console.log('  --- Vite (renderer) ---')
check(fileExists('dist/index.html'), 'dist/index.html exists')
check(dirContains('dist/assets', /\.js$/), 'dist/assets/ contains JS bundles')
check(dirContains('dist/assets', /\.css$/), 'dist/assets/ contains CSS')

// Check bundle size
const jsFiles = fs.existsSync(path.join(ROOT, 'dist/assets'))
  ? fs.readdirSync(path.join(ROOT, 'dist/assets')).filter(f => f.endsWith('.js'))
  : []
for (const f of jsFiles) {
  const size = fileSize(`dist/assets/${f}`)
  const sizeKb = Math.round(size / 1024)
  check(size < 2 * 1024 * 1024, `${f} is ${sizeKb}KB (< 2MB)`, size > 1024 * 1024 ? 'warn' : 'error')
}

// Check font files are bundled (not loaded from CDN)
const fontFiles = fs.existsSync(path.join(ROOT, 'dist/assets'))
  ? fs.readdirSync(path.join(ROOT, 'dist/assets')).filter(f => f.endsWith('.woff2'))
  : []
check(fontFiles.length >= 1, `${fontFiles.length} font files bundled (expected ≥1)`)

// Verify no Google Fonts stylesheet links in output (CSP references are OK)
const htmlContent = fileExists('dist/index.html')
  ? fs.readFileSync(path.join(ROOT, 'dist/index.html'), 'utf-8')
  : ''
const hasFontLink = /href=["'][^"']*fonts\.googleapis\.com/.test(htmlContent)
check(!hasFontLink, 'No Google Fonts CDN stylesheet links in HTML')

if (jsFiles.length > 0) {
  const mainJs = fs.readFileSync(path.join(ROOT, 'dist/assets', jsFiles[0]), 'utf-8')
  check(!mainJs.includes('fonts.googleapis.com'), 'No Google Fonts CDN references in JS')
}

// 2. Electron main process
console.log('\n  --- Electron (main process) ---')
check(fileExists('dist-electron/main.js'), 'dist-electron/main.js exists')
check(fileExists('dist-electron/preload.js'), 'dist-electron/preload.js exists')
check(fileExists('dist-electron/shared/types.js'), 'dist-electron/shared/types.js compiled')

// Check analyzers are compiled (rootDir is "." so electron/ maps to dist-electron/electron/)
const eDir = 'dist-electron/electron'
check(fileExists(`${eDir}/analyzers/index.js`), 'analyzers/index.js compiled')
check(fileExists(`${eDir}/analyzers/extractor.js`), 'analyzers/extractor.js compiled')
check(fileExists(`${eDir}/analyzers/heuristic.js`), 'analyzers/heuristic.js compiled')
check(fileExists(`${eDir}/analyzers/deduplicator.js`), 'analyzers/deduplicator.js compiled')
check(fileExists(`${eDir}/analyzers/flowInference.js`), 'analyzers/flowInference.js compiled')
check(fileExists(`${eDir}/analyzers/vulnScanner.js`), 'analyzers/vulnScanner.js compiled')
check(fileExists(`${eDir}/analyzers/monorepo.js`), 'analyzers/monorepo.js compiled')

// Check AI module
check(fileExists(`${eDir}/ai/deepAnalyzer.js`), 'ai/deepAnalyzer.js compiled')
check(fileExists(`${eDir}/ai/provider.js`), 'ai/provider.js compiled')

// Verify SERVICE_CATEGORIES is exported in compiled types
const typesJs = fileExists('dist-electron/shared/types.js')
  ? fs.readFileSync(path.join(ROOT, 'dist-electron/shared/types.js'), 'utf-8')
  : ''
check(typesJs.includes('SERVICE_CATEGORIES'), 'SERVICE_CATEGORIES exported in compiled types')

// 3. Security checks
console.log('\n  --- Security ---')

// Security checks against the compiled main process entry
const compiledMain = `${eDir}/main.js`
const mainJsContent = fileExists(compiledMain)
  ? fs.readFileSync(path.join(ROOT, compiledMain), 'utf-8')
  : ''
check(!mainJsContent.includes('stackwatch-v1-local-encryption'), 'No hardcoded encryption key in main.js')
check(mainJsContent.includes('safeStorage'), 'safeStorage used for encryption')
check(mainJsContent.includes('Content-Security-Policy'), 'CSP headers configured')

// No .env files in dist
check(!fileExists('dist/.env'), 'No .env in dist/')
check(!fileExists('dist-electron/.env'), 'No .env in dist-electron/')

// 4. Package.json
console.log('\n  --- Package metadata ---')
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'))
check(pkg.main === 'dist-electron/main.js', `main points to dist-electron/main.js`)
check(pkg.name && pkg.name.length > 0, `name: ${pkg.name}`)
check(pkg.version && /^\d+\.\d+\.\d+/.test(pkg.version), `version: ${pkg.version}`)
check(pkg.license === 'MIT', `license: ${pkg.license}`)

// 5. electron-builder config
console.log('\n  --- electron-builder ---')
check(fileExists('electron-builder.yml'), 'electron-builder.yml exists')

// Summary
console.log('\n  ' + '─'.repeat(40))
if (errors > 0) {
  console.error(`\n  ✕ ${errors} error(s), ${warnings} warning(s)\n`)
  process.exit(1)
} else if (warnings > 0) {
  console.log(`\n  ✓ Passed with ${warnings} warning(s)\n`)
} else {
  console.log('\n  ✓ All checks passed\n')
}
