# Contributing to StackWatch

Thank you for your interest in contributing to StackWatch. Whether you are reporting a bug, suggesting a feature, or submitting code, your contribution is valued.

## Reporting Bugs

Open a [GitHub Issue](https://github.com/alciller88/StackWatch/issues) with the following details:

- Your operating system and version
- Node.js version (`node -v`)
- Steps to reproduce the issue
- Expected behavior vs. actual behavior
- Screenshots or error output, if applicable

## Suggesting Features

Open a [GitHub Issue](https://github.com/alciller88/StackWatch/issues) and describe:

- The problem the feature would solve
- Your proposed solution (if any)
- Any alternatives you have considered

## Development Setup

### Prerequisites

- Node.js >= 20
- npm

### Getting Started

```bash
git clone https://github.com/alciller88/StackWatch.git
cd StackWatch
npm install
npm run dev
```

### Running Tests

```bash
npm test
```

The test suite contains 372 tests. All tests must pass before submitting a pull request.

## Project Structure

```
src/           — React front-end (Vite + TypeScript)
electron/      — Electron main process and file analyzers
cli/           — CLI entry point
```

For a detailed breakdown of the architecture, see [CONTEXT.md](./CONTEXT.md).

## Code Style Guidelines

### TypeScript

- Strict mode is enabled. Do not use `any`.
- Write pure functions for analyzers — no side effects.

### Styling

- Use **Tailwind CSS** utility classes for all styling.
- Do not use inline styles or JavaScript-based hover handlers.
- Use CSS variables defined in `themes.ts` for colors. Do not hardcode hex values.

### Testing

- Use **Vitest** for all tests.
- Co-locate test files in `__tests__/` directories next to the source.
- Every new analyzer or feature should include tests.

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation changes
- `chore:` — maintenance tasks
- `test:` — adding or updating tests
- `refactor:` — code restructuring without behavior change

## Pull Request Process

1. **Fork** the repository and create a branch:
   ```bash
   git checkout -b feat/your-feature
   ```
2. **Commit** your changes using conventional commit messages.
3. **Verify** before pushing:
   - All 372 tests pass (`npm test`)
   - TypeScript compiles without errors (`npx tsc --noEmit`)
   - Your code follows the existing patterns and conventions
4. **Open a pull request** against `main` with a clear description of what changed and why.
5. Address any review feedback promptly.

## Adding a New Analyzer

1. Create `electron/analyzers/yourAnalyzer.ts` exporting a pure function.
2. Register it in `electron/analyzers/index.ts`.
3. Add tests in `electron/analyzers/__tests__/yourAnalyzer.test.ts`.
4. Open a PR — new analyzers are always welcome.

## Code of Conduct

All participants are expected to treat each other with respect and professionalism. Harassment, discrimination, and disruptive behavior will not be tolerated. Maintainers reserve the right to remove contributions or ban participants who violate these standards.

## License

By contributing to StackWatch, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
