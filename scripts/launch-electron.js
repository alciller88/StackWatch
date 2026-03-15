const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const isWSL = fs.existsSync('/proc/version') &&
  fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft')

let electronBin

if (isWSL) {
  // In WSL, use the Windows .exe binary from Electron's dist
  electronBin = path.join(__dirname, '../node_modules/electron/dist/electron.exe')
  if (!fs.existsSync(electronBin)) {
    console.error(
      'electron.exe not found at', electronBin,
      '\nRun: npx electron install'
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
