import { describe, it, expect } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { analyzeLocalRepo } from '../index'

/**
 * Verifies that StackWatch scan never writes, creates, or modifies
 * any files in the analyzed project directory.
 */
describe('scan does not write to analyzed project', () => {
  it('empty directory remains empty after scan', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sw-nowrite-'))
    try {
      // Snapshot directory contents before scan
      const beforeFiles = await fs.readdir(tmpDir)
      expect(beforeFiles).toHaveLength(0)

      // Run the scan
      await analyzeLocalRepo(tmpDir)

      // Verify no files were created
      const afterFiles = await fs.readdir(tmpDir)
      expect(afterFiles).toHaveLength(0)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('project with package.json is not modified after scan', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sw-nowrite-'))
    try {
      // Create a minimal project structure
      const pkgContent = JSON.stringify({
        name: 'test-project',
        dependencies: { 'stripe': '^12.0.0', 'express': '^4.18.0' },
      })
      await fs.writeFile(path.join(tmpDir, 'package.json'), pkgContent)
      await fs.writeFile(path.join(tmpDir, '.env.example'), 'STRIPE_SECRET_KEY=sk_test_xxx\nREDIS_URL=redis://localhost:6379')

      // Snapshot directory contents before scan
      const beforeFiles = (await fs.readdir(tmpDir)).sort()
      const beforePkgStat = await fs.stat(path.join(tmpDir, 'package.json'))

      // Run the scan
      const result = await analyzeLocalRepo(tmpDir)

      // Verify services were detected (scan actually ran)
      expect(result.services.length).toBeGreaterThan(0)
      expect(result.dependencies.length).toBeGreaterThan(0)

      // Verify no files were added, removed, or modified
      const afterFiles = (await fs.readdir(tmpDir)).sort()
      expect(afterFiles).toEqual(beforeFiles)

      // No .stackwatch directory created
      expect(afterFiles).not.toContain('.stackwatch')
      // No stackwatch.config.json created
      expect(afterFiles).not.toContain('stackwatch.config.json')

      // package.json not modified
      const afterPkgStat = await fs.stat(path.join(tmpDir, 'package.json'))
      expect(afterPkgStat.mtimeMs).toBe(beforePkgStat.mtimeMs)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('project with multiple ecosystems is not modified after scan', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sw-nowrite-'))
    try {
      // Create a multi-ecosystem project
      await fs.writeFile(path.join(tmpDir, 'requirements.txt'), 'stripe>=5.0\nredis>=4.0\n')
      await fs.writeFile(path.join(tmpDir, 'go.mod'), 'module example.com/myproject\n\ngo 1.21\n')

      const beforeFiles = (await fs.readdir(tmpDir)).sort()

      await analyzeLocalRepo(tmpDir)

      const afterFiles = (await fs.readdir(tmpDir)).sort()
      expect(afterFiles).toEqual(beforeFiles)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })
})
