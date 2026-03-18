# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.0.x   | Yes                |
| 0.10.x  | Yes                |
| < 0.10  | No                 |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in StackWatch, please report it responsibly via GitHub's private vulnerability reporting:

[Report a vulnerability](https://github.com/alciller88/StackWatch/security/advisories/new)

Please include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Any suggested fixes (optional)

You will receive a response within **72 hours**.

## What to Expect

| Stage | Timeframe |
|-------|-----------|
| Acknowledgement | Within 72 hours |
| Assessment | Within 7 days |
| Fix | Within 30 days for critical issues |
| Disclosure | Coordinated, after fix is released |

## Scope

**In scope:**
- StackWatch desktop application (Electron)
- CLI tool (`stackwatch`)
- GitHub Action (`alciller88/StackWatch`)
- Data handling and encryption

**Out of scope:**
- Vulnerabilities in scanned repositories (StackWatch reports these, not causes them)
- Third-party AI providers configured by the user
- Issues requiring physical access to the machine

## Security Features

- **Credential encryption**: GitHub tokens and API keys encrypted via OS keychain (Electron safeStorage)
- **No telemetry**: No data sent to external servers except configured AI providers and OSV.dev
- **Local first**: All analysis runs locally
- **Context isolation**: Electron contextIsolation enabled, nodeIntegration disabled
- **IPC validation**: All IPC validated with Zod schemas
- **SSRF protection**: AI provider URLs block cloud metadata endpoints
- **Prompt injection prevention**: Service names sanitized before AI prompt interpolation
- **File size limits**: Files >1MB skipped in extractor; AI responses capped at 10MB

## Known Limitations

- On Linux without libsecret or kwallet, credentials are stored without OS-level encryption. A warning is shown at startup.
- AI provider API keys are sent to the configured endpoint. Use trusted providers only.
