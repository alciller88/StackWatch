const { execSync } = require('child_process')
const fs = require('fs')

const isWSL = fs.existsSync('/proc/version') &&
  fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft')

if (!isWSL) {
  process.exit(0)
}

const deps = [
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

console.log('WSL detected — checking Electron system dependencies...')

try {
  // Check which packages are already installed
  const missing = deps.filter((dep) => {
    try {
      execSync(`dpkg -s ${dep} 2>/dev/null`, { stdio: 'pipe' })
      return false
    } catch {
      return true
    }
  })

  if (missing.length === 0) {
    console.log('All system dependencies already installed.')
    process.exit(0)
  }

  console.log('Installing missing dependencies:', missing.join(', '))
  execSync(
    `sudo apt-get update -qq && sudo apt-get install -y ${missing.join(' ')}`,
    { stdio: 'inherit' }
  )
  console.log('Dependencies installed successfully.')
} catch (e) {
  console.warn(
    '\nCould not install dependencies automatically.',
    '\nRun manually:\n',
    `sudo apt-get install -y ${deps.join(' ')}`
  )
}
