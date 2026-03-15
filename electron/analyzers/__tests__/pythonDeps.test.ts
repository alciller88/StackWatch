import { describe, it, expect } from 'vitest'
import { analyzePythonDeps } from '../pythonDeps'

describe('analyzePythonDeps', () => {
  it('parses requirements.txt with versions', () => {
    const content = `
flask==2.3.0
requests>=2.28.0
boto3~=1.28
openai
wandb>=0.15
    `.trim()

    const result = analyzePythonDeps(content, 'requirements.txt')
    expect(result.dependencies).toHaveLength(5)
    expect(result.dependencies[0]).toEqual({
      name: 'flask',
      version: '2.3.0',
      type: 'production',
      ecosystem: 'pip',
    })
    expect(result.dependencies[3]).toMatchObject({
      name: 'openai',
      version: '*',
      ecosystem: 'pip',
    })
  })

  it('detects known services from requirements.txt', () => {
    const content = `
openai>=1.0
boto3>=1.28
wandb>=0.15
stripe>=5.0
    `.trim()

    const result = analyzePythonDeps(content, 'requirements.txt')
    const serviceNames = result.services.map((s) => s.name).sort()
    expect(serviceNames).toEqual(['AWS', 'OpenAI', 'Stripe', 'Weights & Biases'])
  })

  it('parses pyproject.toml dependencies', () => {
    const content = `
[project]
name = "myproject"
dependencies = [
    "openai>=1.0",
    "psycopg2-binary>=2.9",
    "sentry-sdk>=1.0",
]
    `.trim()

    const result = analyzePythonDeps(content, 'pyproject.toml')
    expect(result.dependencies).toHaveLength(3)
    const serviceNames = result.services.map((s) => s.name).sort()
    expect(serviceNames).toEqual(['OpenAI', 'PostgreSQL', 'Sentry'])
  })

  it('parses setup.py install_requires', () => {
    const content = `
from setuptools import setup
setup(
    name="myproject",
    install_requires=[
        "redis>=4.0",
        "celery>=5.0",
    ],
)
    `.trim()

    const result = analyzePythonDeps(content, 'setup.py')
    expect(result.dependencies).toHaveLength(2)
    const serviceNames = result.services.map((s) => s.name).sort()
    expect(serviceNames).toEqual(['Celery', 'Redis'])
  })

  it('skips comments and blank lines in requirements.txt', () => {
    const content = `
# ML dependencies
openai

# ignore flags
-r other-requirements.txt
    `.trim()

    const result = analyzePythonDeps(content, 'requirements.txt')
    expect(result.dependencies).toHaveLength(1)
    expect(result.dependencies[0].name).toBe('openai')
  })

  it('deduplicates services', () => {
    const content = `
psycopg2>=2.9
psycopg2-binary>=2.9
    `.trim()

    const result = analyzePythonDeps(content, 'requirements.txt')
    expect(result.services).toHaveLength(1)
    expect(result.services[0].name).toBe('PostgreSQL')
  })

  it('sets correct inferredFrom', () => {
    const content = 'openai>=1.0'
    const result = analyzePythonDeps(content, 'requirements.txt')
    expect(result.services[0].inferredFrom).toBe('requirements.txt → openai')
  })
})
