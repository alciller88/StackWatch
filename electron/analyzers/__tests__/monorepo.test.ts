import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    readdir: vi.fn(),
    access: vi.fn(),
    stat: vi.fn(),
  },
}))

vi.mock('js-yaml', () => ({
  load: vi.fn(),
}))

import fs from 'fs/promises'
import { load as loadYaml } from 'js-yaml'
import { detectMonorepo } from '../monorepo'

const mockFs = vi.mocked(fs)
const mockLoadYaml = vi.mocked(loadYaml)

beforeEach(() => {
  vi.resetAllMocks()
  mockFs.readFile.mockRejectedValue(new Error('ENOENT'))
  mockFs.readdir.mockRejectedValue(new Error('ENOENT'))
  mockFs.access.mockRejectedValue(new Error('ENOENT'))
  mockFs.stat.mockRejectedValue(new Error('ENOENT'))
})

describe('detectMonorepo', () => {
  const ROOT = '/fake/project'

  it('returns null type for non-monorepo', async () => {
    const result = await detectMonorepo(ROOT)
    expect(result.type).toBeNull()
    expect(result.packages).toEqual([])
    expect(result.root).toBe(ROOT)
  })

  describe('npm workspaces', () => {
    it('detects workspaces array format', async () => {
      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath === path.join(ROOT, 'package.json')) {
          return JSON.stringify({ workspaces: ['packages/*'] })
        }
        throw new Error('ENOENT')
      })
      mockFs.readdir.mockImplementation(async (dirPath: any) => {
        if ((dirPath as string) === path.join(ROOT, 'packages')) {
          return [
            { name: 'app', isDirectory: () => true },
            { name: 'lib', isDirectory: () => true },
          ] as any
        }
        throw new Error('ENOENT')
      })
      mockFs.access.mockImplementation(async (filePath: any) => {
        const str = filePath as string
        if (str === path.join(ROOT, 'packages', 'app', 'package.json')) return
        if (str === path.join(ROOT, 'packages', 'lib', 'package.json')) return
        throw new Error('ENOENT')
      })

      const result = await detectMonorepo(ROOT)
      expect(result.type).toBe('npm-workspaces')
      expect(result.packages).toHaveLength(2)
      expect(result.packages).toContain(path.join(ROOT, 'packages', 'app'))
      expect(result.packages).toContain(path.join(ROOT, 'packages', 'lib'))
    })

    it('detects workspaces object format (workspaces.packages)', async () => {
      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath === path.join(ROOT, 'package.json')) {
          return JSON.stringify({ workspaces: { packages: ['packages/*'] } })
        }
        throw new Error('ENOENT')
      })
      mockFs.readdir.mockImplementation(async (dirPath: any) => {
        if ((dirPath as string) === path.join(ROOT, 'packages')) {
          return [{ name: 'core', isDirectory: () => true }] as any
        }
        throw new Error('ENOENT')
      })
      mockFs.access.mockImplementation(async (filePath: any) => {
        if ((filePath as string) === path.join(ROOT, 'packages', 'core', 'package.json')) return
        throw new Error('ENOENT')
      })

      const result = await detectMonorepo(ROOT)
      expect(result.type).toBe('npm-workspaces')
      expect(result.packages).toEqual([path.join(ROOT, 'packages', 'core')])
    })

    it('returns empty packages for empty workspaces array', async () => {
      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath === path.join(ROOT, 'package.json')) {
          return JSON.stringify({ workspaces: [] })
        }
        throw new Error('ENOENT')
      })

      const result = await detectMonorepo(ROOT)
      expect(result.packages).toEqual([])
    })
  })

  describe('pnpm workspaces', () => {
    it('detects pnpm-workspace.yaml', async () => {
      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath === path.join(ROOT, 'pnpm-workspace.yaml')) {
          return 'packages:\n  - packages/*'
        }
        throw new Error('ENOENT')
      })
      mockLoadYaml.mockReturnValue({ packages: ['packages/*'] })
      mockFs.readdir.mockImplementation(async (dirPath: any) => {
        if ((dirPath as string) === path.join(ROOT, 'packages')) {
          return [{ name: 'ui', isDirectory: () => true }] as any
        }
        throw new Error('ENOENT')
      })
      mockFs.access.mockImplementation(async (filePath: any) => {
        if ((filePath as string) === path.join(ROOT, 'packages', 'ui', 'package.json')) return
        throw new Error('ENOENT')
      })

      const result = await detectMonorepo(ROOT)
      expect(result.type).toBe('pnpm')
      expect(result.packages).toEqual([path.join(ROOT, 'packages', 'ui')])
    })
  })

  describe('lerna', () => {
    it('detects lerna.json', async () => {
      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath === path.join(ROOT, 'lerna.json')) {
          return JSON.stringify({ packages: ['modules/*'] })
        }
        throw new Error('ENOENT')
      })
      mockFs.readdir.mockImplementation(async (dirPath: any) => {
        if ((dirPath as string) === path.join(ROOT, 'modules')) {
          return [{ name: 'server', isDirectory: () => true }] as any
        }
        throw new Error('ENOENT')
      })
      mockFs.access.mockImplementation(async (filePath: any) => {
        if ((filePath as string) === path.join(ROOT, 'modules', 'server', 'package.json')) return
        throw new Error('ENOENT')
      })

      const result = await detectMonorepo(ROOT)
      expect(result.type).toBe('lerna')
      expect(result.packages).toEqual([path.join(ROOT, 'modules', 'server')])
    })

    it('uses default packages/* when lerna.json has no packages field', async () => {
      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath === path.join(ROOT, 'lerna.json')) {
          return JSON.stringify({ version: '1.0.0' })
        }
        throw new Error('ENOENT')
      })
      mockFs.readdir.mockImplementation(async (dirPath: any) => {
        if ((dirPath as string) === path.join(ROOT, 'packages')) {
          return [{ name: 'shared', isDirectory: () => true }] as any
        }
        throw new Error('ENOENT')
      })
      mockFs.access.mockImplementation(async (filePath: any) => {
        if ((filePath as string) === path.join(ROOT, 'packages', 'shared', 'Cargo.toml')) return
        throw new Error('ENOENT')
      })

      const result = await detectMonorepo(ROOT)
      expect(result.type).toBe('lerna')
      expect(result.packages).toHaveLength(1)
    })
  })

  describe('turborepo', () => {
    it('detects turbo.json', async () => {
      mockFs.access.mockImplementation(async (filePath: any) => {
        const str = filePath as string
        if (str === path.join(ROOT, 'turbo.json')) return
        if (str === path.join(ROOT, 'packages', 'web', 'package.json')) return
        if (str === path.join(ROOT, 'apps', 'api', 'package.json')) return
        throw new Error('ENOENT')
      })
      mockFs.readdir.mockImplementation(async (dirPath: any) => {
        const str = dirPath as string
        if (str === path.join(ROOT, 'packages')) {
          return [{ name: 'web', isDirectory: () => true }] as any
        }
        if (str === path.join(ROOT, 'apps')) {
          return [{ name: 'api', isDirectory: () => true }] as any
        }
        throw new Error('ENOENT')
      })

      const result = await detectMonorepo(ROOT)
      expect(result.type).toBe('turborepo')
      expect(result.packages).toHaveLength(2)
    })
  })

  describe('nx', () => {
    it('detects nx.json', async () => {
      mockFs.access.mockImplementation(async (filePath: any) => {
        const str = filePath as string
        if (str === path.join(ROOT, 'nx.json')) return
        if (str === path.join(ROOT, 'libs', 'shared', 'package.json')) return
        throw new Error('ENOENT')
      })
      mockFs.readdir.mockImplementation(async (dirPath: any) => {
        const str = dirPath as string
        if (str === path.join(ROOT, 'libs')) {
          return [{ name: 'shared', isDirectory: () => true }] as any
        }
        if (str === path.join(ROOT, 'packages') || str === path.join(ROOT, 'apps')) {
          return [] as any
        }
        throw new Error('ENOENT')
      })

      const result = await detectMonorepo(ROOT)
      expect(result.type).toBe('nx')
      expect(result.packages).toEqual([path.join(ROOT, 'libs', 'shared')])
    })
  })

  describe('glob resolution', () => {
    it('skips dotfiles and node_modules', async () => {
      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath === path.join(ROOT, 'package.json')) {
          return JSON.stringify({ workspaces: ['packages/*'] })
        }
        throw new Error('ENOENT')
      })
      mockFs.readdir.mockImplementation(async (dirPath: any) => {
        if ((dirPath as string) === path.join(ROOT, 'packages')) {
          return [
            { name: '.hidden', isDirectory: () => true },
            { name: 'node_modules', isDirectory: () => true },
            { name: 'valid', isDirectory: () => true },
          ] as any
        }
        throw new Error('ENOENT')
      })
      mockFs.access.mockImplementation(async (filePath: any) => {
        if ((filePath as string) === path.join(ROOT, 'packages', 'valid', 'package.json')) return
        throw new Error('ENOENT')
      })

      const result = await detectMonorepo(ROOT)
      expect(result.packages).toEqual([path.join(ROOT, 'packages', 'valid')])
    })

    it('skips non-directory entries', async () => {
      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath === path.join(ROOT, 'package.json')) {
          return JSON.stringify({ workspaces: ['packages/*'] })
        }
        throw new Error('ENOENT')
      })
      mockFs.readdir.mockImplementation(async (dirPath: any) => {
        if ((dirPath as string) === path.join(ROOT, 'packages')) {
          return [
            { name: 'README.md', isDirectory: () => false },
            { name: 'app', isDirectory: () => true },
          ] as any
        }
        throw new Error('ENOENT')
      })
      mockFs.access.mockImplementation(async (filePath: any) => {
        if ((filePath as string) === path.join(ROOT, 'packages', 'app', 'package.json')) return
        throw new Error('ENOENT')
      })

      const result = await detectMonorepo(ROOT)
      expect(result.packages).toEqual([path.join(ROOT, 'packages', 'app')])
    })

    it('skips directories without a manifest file', async () => {
      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath === path.join(ROOT, 'package.json')) {
          return JSON.stringify({ workspaces: ['packages/*'] })
        }
        throw new Error('ENOENT')
      })
      mockFs.readdir.mockImplementation(async (dirPath: any) => {
        if ((dirPath as string) === path.join(ROOT, 'packages')) {
          return [{ name: 'no-manifest', isDirectory: () => true }] as any
        }
        throw new Error('ENOENT')
      })

      const result = await detectMonorepo(ROOT)
      expect(result.packages).toEqual([])
    })
  })
})
