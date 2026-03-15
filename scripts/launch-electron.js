const { spawn, execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

function isWSL() {
  try {
    const version = fs.readFileSync('/proc/version', 'utf8').toLowerCase()
    return version.includes('microsoft') || version.includes('wsl')
  } catch {
    return false
  }
}

let electronBin
let spawnArgs = ['.']
let spawnOptions = { stdio: 'inherit', env: { ...process.env } }

if (isWSL()) {
  // En WSL2: usar el .exe de Windows — no necesita librerías Linux
  electronBin = path.join(__dirname, '../node_modules/electron/dist/electron.exe')
  if (!fs.existsSync(electronBin)) {
    // npm on WSL2 installs the Linux binary — re-run electron's installer
    // with win32 platform to download the Windows binary instead
    console.log('WSL2 detected — downloading Windows Electron binary...')
    try {
      execSync('node install.js', {
        cwd: path.join(__dirname, '../node_modules/electron'),
        stdio: 'inherit',
        env: { ...process.env, npm_config_platform: 'win32' }
      })
    } catch (e) {
      console.error('Failed to download Windows Electron binary:', e.message)
      process.exit(1)
    }
    if (!fs.existsSync(electronBin)) {
      console.error('electron.exe still not found after download — check network and retry')
      process.exit(1)
    }
  }
  // Convertir la ruta WSL a ruta Windows para que electron.exe la entienda
  // Ej: /mnt/c/Users/... → C:\Users\...
  const cwd = process.cwd()
  const winCwd = cwd.replace(/^\/mnt\/([a-z])/, (_, drive) => `${drive.toUpperCase()}:`)
                    .replace(/\//g, '\\')
  spawnArgs = [winCwd]
} else {
  electronBin = require('electron')
}

const child = spawn(electronBin, spawnArgs, spawnOptions)
child.on('exit', (code) => process.exit(code ?? 0))
