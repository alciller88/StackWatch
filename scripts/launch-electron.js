const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const isWSL = fs.existsSync('/proc/version') &&
  fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft')

let electronBin

if (isWSL) {
  // In WSL2, try the Windows .exe first (if installed), then fall back to the Linux binary
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
