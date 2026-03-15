const { spawn, execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const isWSL = fs.existsSync('/proc/version') &&
  fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft')

/**
 * On WSL2 the Linux Electron binary needs system libraries that are not
 * installed by default.  Check for the critical ones before launching so
 * the developer gets a clear, actionable message instead of a cryptic
 * "cannot open shared object file" error.
 */
function checkWSLDeps() {
  const required = [
    'libnss3',
    'libatk1.0-0',
    'libatk-bridge2.0-0',
    'libcups2',
    'libdrm2',
    'libxkbcommon0',
    'libxcomposite1',
    'libxdamage1',
    'libxfixes3',
    'libxrandr2',
    'libgbm1',
    'libasound2'
  ]

  const missing = required.filter((dep) => {
    try {
      execSync(`dpkg -s ${dep} 2>/dev/null`, { stdio: 'pipe' })
      return false
    } catch {
      return true
    }
  })

  if (missing.length > 0) {
    console.error(
      '\n✖ Missing system libraries required by Electron on WSL2:\n',
      missing.join(', '),
      '\n\nInstall them with:\n',
      `  sudo apt-get update && sudo apt-get install -y ${missing.join(' ')}`,
      '\n\nThen re-run: npm run dev\n'
    )
    process.exit(1)
  }
}

let electronBin

if (isWSL) {
  checkWSLDeps()

  const winBin = path.join(__dirname, '../node_modules/electron/dist/electron.exe')
  const linuxBin = path.join(__dirname, '../node_modules/electron/dist/electron')

  if (fs.existsSync(winBin)) {
    electronBin = winBin
  } else if (fs.existsSync(linuxBin)) {
    electronBin = linuxBin
  } else {
    console.error(
      'Electron binary not found in node_modules/electron/dist/',
      '\nRun: npm install electron'
    )
    process.exit(1)
  }
} else {
  electronBin = require('electron')
}

const child = spawn(electronBin, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
})

child.on('exit', (code) => process.exit(code ?? 0))
