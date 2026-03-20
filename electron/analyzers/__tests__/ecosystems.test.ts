import { describe, it, expect } from 'vitest'
import { extractEvidencesFromGitHub } from '../extractor'
import { analyzeGitHubRepo } from '../index'

function mockFetchFile(files: Record<string, string>) {
  return async (path: string): Promise<string | null> => {
    return files[path] ?? null
  }
}

function mockListDir(dirs: Record<string, string[]>) {
  return async (path: string): Promise<string[]> => {
    return dirs[path] ?? []
  }
}

describe('.NET ecosystem', () => {
  it('.csproj with NuGet packages', async () => {
    const { evidences, dependencies } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'MyApp.csproj': `<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Stripe.net" Version="40.0.0" />
    <PackageReference Include="StackExchange.Redis" Version="2.6.0" />
  </ItemGroup>
</Project>`,
      }),
      mockListDir({ '.': ['MyApp.csproj'] }),
    )

    const nugetDeps = dependencies.filter(d => d.ecosystem === 'nuget')
    expect(nugetDeps).toHaveLength(2)
    expect(nugetDeps.map(d => d.name)).toContain('Stripe.net')
    expect(nugetDeps.map(d => d.name)).toContain('StackExchange.Redis')
    expect(nugetDeps[0]!.version).toBe('40.0.0')
    expect(nugetDeps[1]!.version).toBe('2.6.0')
    expect(nugetDeps[0]!.type).toBe('production')

    const importEvidences = evidences.filter(e => e.type === 'import')
    expect(importEvidences.map(e => e.value)).toContain('Stripe.net')
    expect(importEvidences.map(e => e.value)).toContain('StackExchange.Redis')
  })

  it('appsettings.json with ConnectionStrings (SQL Server)', async () => {
    const { evidences } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'appsettings.json': JSON.stringify({
          ConnectionStrings: {
            Default: 'Server=localhost;Database=mydb',
          },
        }),
      }),
      mockListDir({}),
    )

    const domains = evidences.filter(e => e.type === 'domain')
    expect(domains.map(e => e.value)).toContain('sqlserver')
  })

  it('appsettings.json with PostgreSQL connection string', async () => {
    const { evidences } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'appsettings.json': JSON.stringify({
          ConnectionStrings: {
            Default: 'postgres://localhost:5432/mydb',
          },
        }),
      }),
      mockListDir({}),
    )

    const domains = evidences.filter(e => e.type === 'domain')
    expect(domains.map(e => e.value)).toContain('postgresql')
  })

  it('appsettings.json with Redis config and Sentry DSN', async () => {
    const { evidences } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'appsettings.json': JSON.stringify({
          Redis: {
            Configuration: 'localhost:6379',
          },
          Sentry: {
            Dsn: 'https://key@sentry.io/123',
          },
        }),
      }),
      mockListDir({}),
    )

    const envVars = evidences.filter(e => e.type === 'env_var')
    const envVarValues = envVars.map(e => e.value)
    // The JSON config parser should extract keys ending with DSN as env_var evidence
    expect(envVarValues).toContain('SENTRY_DSN')
  })

  it('empty .csproj', async () => {
    const { dependencies } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'Empty.csproj': '<Project Sdk="Microsoft.NET.Sdk"></Project>',
      }),
      mockListDir({ '.': ['Empty.csproj'] }),
    )

    const nugetDeps = dependencies.filter(d => d.ecosystem === 'nuget')
    expect(nugetDeps).toHaveLength(0)
  })
})

describe('Java ecosystem', () => {
  it('pom.xml with Maven dependencies', async () => {
    const { evidences, dependencies } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'pom.xml': `<project><dependencies>
  <dependency><groupId>com.stripe</groupId><artifactId>stripe-java</artifactId><version>22.0.0</version></dependency>
  <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-redis</artifactId><version>3.1.0</version></dependency>
  <dependency><groupId>junit</groupId><artifactId>junit</artifactId><version>4.13</version><scope>test</scope></dependency>
</dependencies></project>`,
      }),
      mockListDir({}),
    )

    const mavenDeps = dependencies.filter(d => d.ecosystem === 'maven')
    expect(mavenDeps).toHaveLength(3)

    const prodDeps = mavenDeps.filter(d => d.type === 'production')
    expect(prodDeps).toHaveLength(2)

    const devDeps = mavenDeps.filter(d => d.type === 'development')
    expect(devDeps).toHaveLength(1)
    expect(devDeps[0]!.name).toContain('junit')

    const importEvidences = evidences.filter(e => e.type === 'import')
    expect(importEvidences.map(e => e.value)).toContain('stripe-java')
    expect(importEvidences.map(e => e.value)).toContain('spring-boot-starter-data-redis')
    expect(importEvidences.map(e => e.value)).toContain('junit')
  })

  it('build.gradle with Gradle dependencies', async () => {
    const { dependencies } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'build.gradle': `dependencies {
    implementation 'com.stripe:stripe-java:22.0.0'
    implementation "org.mongodb:mongodb-driver-sync:4.9.0"
    testImplementation 'junit:junit:4.13'
}`,
      }),
      mockListDir({}),
    )

    const gradleDeps = dependencies.filter(d => d.ecosystem === 'gradle')
    expect(gradleDeps).toHaveLength(3)

    const prodDeps = gradleDeps.filter(d => d.type === 'production')
    expect(prodDeps).toHaveLength(2)
    expect(prodDeps.map(d => d.name)).toContain('com.stripe:stripe-java')
    expect(prodDeps.map(d => d.name)).toContain('org.mongodb:mongodb-driver-sync')

    const devDeps = gradleDeps.filter(d => d.type === 'development')
    expect(devDeps).toHaveLength(1)
    expect(devDeps[0]!.name).toContain('junit')
  })

  it('application.properties with database URL', async () => {
    const { evidences } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'src/main/resources/application.properties': 'spring.datasource.url=jdbc:postgresql://localhost:5432/mydb',
      }),
      mockListDir({}),
    )

    const domains = evidences.filter(e => e.type === 'domain')
    expect(domains.map(e => e.value)).toContain('postgresql')
  })

  it('application.yml with Redis and MongoDB', async () => {
    const { evidences } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'src/main/resources/application.yml': `spring:
  redis:
    host: localhost
    port: 6379
  data:
    mongodb:
      uri: mongodb://localhost:27017/mydb`,
      }),
      mockListDir({}),
    )

    const domains = evidences.filter(e => e.type === 'domain')
    expect(domains.map(e => e.value)).toContain('redis')
    expect(domains.map(e => e.value)).toContain('mongodb')
  })

  it('empty pom.xml', async () => {
    const { dependencies } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'pom.xml': '<project></project>',
      }),
      mockListDir({}),
    )

    const mavenDeps = dependencies.filter(d => d.ecosystem === 'maven')
    expect(mavenDeps).toHaveLength(0)
  })
})

describe('Ruby ecosystem', () => {
  it('Gemfile with gems', async () => {
    const { evidences, dependencies } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'Gemfile': `source 'https://rubygems.org'
gem 'rails', '~> 7.0'
gem 'stripe', '~> 9.0'
gem 'redis', '>= 4.0'
gem 'rspec', group: :development
`,
      }),
      mockListDir({}),
    )

    const gemDeps = dependencies.filter(d => d.ecosystem === 'gem')
    expect(gemDeps).toHaveLength(4)
    expect(gemDeps.map(d => d.name)).toContain('rails')
    expect(gemDeps.map(d => d.name)).toContain('stripe')
    expect(gemDeps.map(d => d.name)).toContain('redis')
    expect(gemDeps.map(d => d.name)).toContain('rspec')

    const rspec = gemDeps.find(d => d.name === 'rspec')
    expect(rspec!.type).toBe('development')

    const importEvidences = evidences.filter(e => e.type === 'import')
    expect(importEvidences.map(e => e.value)).toContain('rails')
    expect(importEvidences.map(e => e.value)).toContain('stripe')
    expect(importEvidences.map(e => e.value)).toContain('redis')
  })

  it('config/database.yml with PostgreSQL', async () => {
    const { evidences } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'config/database.yml': `default: &default
  adapter: postgresql
  pool: 5

development:
  <<: *default
  database: myapp_dev`,
      }),
      mockListDir({}),
    )

    const domains = evidences.filter(e => e.type === 'domain')
    expect(domains.map(e => e.value)).toContain('postgresql')
  })

  it('config/database.yml with MySQL', async () => {
    const { evidences } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'config/database.yml': `default: &default
  adapter: mysql2
  pool: 5

development:
  <<: *default
  database: myapp_dev`,
      }),
      mockListDir({}),
    )

    const domains = evidences.filter(e => e.type === 'domain')
    expect(domains.map(e => e.value)).toContain('mysql')
  })

  it('empty Gemfile', async () => {
    const { dependencies } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'Gemfile': '',
      }),
      mockListDir({}),
    )

    const gemDeps = dependencies.filter(d => d.ecosystem === 'gem')
    expect(gemDeps).toHaveLength(0)
  })
})

describe('PHP ecosystem', () => {
  it('composer.json with packages', async () => {
    const { evidences, dependencies } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'composer.json': JSON.stringify({
          require: {
            'php': '^8.1',
            'stripe/stripe-php': '^10.0',
            'predis/predis': '^2.0',
          },
          'require-dev': {
            'phpunit/phpunit': '^10.0',
          },
        }),
      }),
      mockListDir({}),
    )

    const composerDeps = dependencies.filter(d => d.ecosystem === 'composer')
    // php is filtered out, so 2 production + 1 dev = 3
    expect(composerDeps).toHaveLength(3)

    const prodDeps = composerDeps.filter(d => d.type === 'production')
    expect(prodDeps).toHaveLength(2)
    expect(prodDeps.map(d => d.name)).toContain('stripe/stripe-php')
    expect(prodDeps.map(d => d.name)).toContain('predis/predis')

    const devDeps = composerDeps.filter(d => d.type === 'development')
    expect(devDeps).toHaveLength(1)
    expect(devDeps[0]!.name).toBe('phpunit/phpunit')

    const importEvidences = evidences.filter(e => e.type === 'import')
    expect(importEvidences.map(e => e.value)).toContain('stripe-php')
    expect(importEvidences.map(e => e.value)).toContain('predis')
    expect(importEvidences.map(e => e.value)).toContain('stripe/stripe-php')
  })

  it('empty composer.json', async () => {
    const { dependencies } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'composer.json': '{}',
      }),
      mockListDir({}),
    )

    const composerDeps = dependencies.filter(d => d.ecosystem === 'composer')
    expect(composerDeps).toHaveLength(0)
  })

  it('malformed composer.json', async () => {
    const { dependencies } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'composer.json': '{ this is not valid json',
      }),
      mockListDir({}),
    )

    const composerDeps = dependencies.filter(d => d.ecosystem === 'composer')
    expect(composerDeps).toHaveLength(0)
  })
})

describe('Python ecosystem extensions', () => {
  it('Pipfile with packages', async () => {
    const { dependencies } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'Pipfile': `[packages]
stripe = "*"
redis = ">=4.0"

[dev-packages]
pytest = "*"`,
      }),
      mockListDir({}),
    )

    const pipDeps = dependencies.filter(d => d.ecosystem === 'pip')
    expect(pipDeps).toHaveLength(3)

    const prodDeps = pipDeps.filter(d => d.type === 'production')
    expect(prodDeps).toHaveLength(2)
    expect(prodDeps.map(d => d.name)).toContain('stripe')
    expect(prodDeps.map(d => d.name)).toContain('redis')

    const devDeps = pipDeps.filter(d => d.type === 'development')
    expect(devDeps).toHaveLength(1)
    expect(devDeps[0]!.name).toBe('pytest')
  })

  it('setup.cfg with install_requires', async () => {
    const { dependencies } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'setup.cfg': `[options]
install_requires =
    stripe>=5.0
    redis`,
      }),
      mockListDir({}),
    )

    const pipDeps = dependencies.filter(d => d.ecosystem === 'pip')
    expect(pipDeps).toHaveLength(2)
    expect(pipDeps.map(d => d.name)).toContain('stripe')
    expect(pipDeps.map(d => d.name)).toContain('redis')
  })
})

describe('ecosystem detection', () => {
  it('detects node ecosystem from package.json', async () => {
    const { ecosystems } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'package.json': JSON.stringify({
          dependencies: { express: '^4.18.0' },
        }),
      }),
      mockListDir({ '.': ['package.json'] }),
    )

    expect(ecosystems).toContain('node')
  })

  it('detects python ecosystem from requirements.txt', async () => {
    const { ecosystems } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'requirements.txt': 'flask>=2.0\nrequests==2.28.0',
      }),
      mockListDir({ '.': ['requirements.txt'] }),
    )

    expect(ecosystems).toContain('python')
  })

  it('detects dotnet ecosystem from .csproj', async () => {
    const { ecosystems } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'MyApp.csproj': `<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Newtonsoft.Json" Version="13.0.0" />
  </ItemGroup>
</Project>`,
      }),
      mockListDir({ '.': ['MyApp.csproj'] }),
    )

    expect(ecosystems).toContain('dotnet')
  })

  it('detects java ecosystem from pom.xml', async () => {
    const { ecosystems } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'pom.xml': `<project><dependencies>
  <dependency><groupId>org.springframework</groupId><artifactId>spring-core</artifactId><version>5.0.0</version></dependency>
</dependencies></project>`,
      }),
      mockListDir({ '.': ['pom.xml'] }),
    )

    expect(ecosystems).toContain('java')
  })

  it('detects multiple ecosystems in monorepo', async () => {
    const { ecosystems } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'package.json': JSON.stringify({
          dependencies: { express: '^4.18.0' },
        }),
        'requirements.txt': 'flask>=2.0',
      }),
      mockListDir({ '.': ['package.json', 'requirements.txt'] }),
    )

    expect(ecosystems).toContain('node')
    expect(ecosystems).toContain('python')
  })

  it('returns empty ecosystems for empty repo', async () => {
    const { ecosystems } = await extractEvidencesFromGitHub(
      mockFetchFile({}),
      mockListDir({ '.': [] }),
    )

    expect(ecosystems).toHaveLength(0)
  })

  it('returns ecosystems sorted alphabetically', async () => {
    const { ecosystems } = await extractEvidencesFromGitHub(
      mockFetchFile({
        'requirements.txt': 'flask>=2.0',
        'package.json': JSON.stringify({
          dependencies: { express: '^4.18.0' },
        }),
      }),
      mockListDir({ '.': ['package.json', 'requirements.txt'] }),
    )

    const sorted = [...ecosystems].sort()
    expect(ecosystems).toEqual(sorted)
  })
})

describe('multi-ecosystem pipeline', () => {
  it('analyzes .NET project with csproj and appsettings', async () => {
    const result = await analyzeGitHubRepo(
      mockFetchFile({
        'MyApp.csproj': `<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Stripe.net" Version="40.0.0" />
  </ItemGroup>
</Project>`,
        'appsettings.json': JSON.stringify({
          ConnectionStrings: {
            Default: 'Server=localhost;Database=mydb',
          },
        }),
      }),
      mockListDir({ '.': ['MyApp.csproj'] }),
    )

    // Should detect services via heuristics from import evidences
    expect(result.services.length).toBeGreaterThanOrEqual(1)

    // Should have Stripe.net as a NuGet dependency
    expect(result.dependencies.map(d => d.name)).toContain('Stripe.net')

    // Should detect SQL Server domain evidence (heuristic maps it to a service)
    const serviceNames = result.services.map(s => s.name.toLowerCase())
    expect(
      serviceNames.some(n => n.includes('sql')) || serviceNames.some(n => n.includes('stripe'))
    ).toBe(true)
  })

  it('analyzes Python project with requirements.txt and .env', async () => {
    const result = await analyzeGitHubRepo(
      mockFetchFile({
        'requirements.txt': 'stripe\nflask>=2.0',
        '.env': 'STRIPE_SECRET_KEY=sk_test_xxx',
      }),
      mockListDir({ '.': ['requirements.txt'] }),
    )

    // Stripe should be detected from both pip dependency and env var evidence
    const stripeService = result.services.find(s =>
      s.name.toLowerCase().includes('stripe')
    )
    expect(stripeService).toBeDefined()

    // With both a dependency and an env var, multiple evidence sources should be present
    // The deduplicator merges evidences, producing at least medium confidence
    expect(stripeService!.confidenceReasons!.length).toBeGreaterThanOrEqual(1)
  })
})
