# Contributing to StackWatch

Thanks for your interest in contributing. StackWatch is a community project — all contributions are welcome.

## Before you start

Read `SPEC.md` and `CONTEXT.md` first. They contain the full technical specification and the current state of the project.

## How to contribute

### Report a bug
Open an issue using the **Bug report** template. Include your OS, Node.js version, and steps to reproduce.

### Suggest a feature
Open an issue using the **Feature request** template. Explain the problem it solves, not just the solution.

### Submit a pull request
1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature` or `fix/your-fix`
3. Make your changes
4. Run tests: `npm test`
5. Commit using conventional commits: `feat:`, `fix:`, `docs:`, `chore:`
6. Open a PR against `main` with a clear description

## Adding a new service detector

1. Add the pattern to `electron/analyzers/envFile.ts`
2. Add a test in `electron/analyzers/__tests__/envFile.test.ts`
3. Open a PR — these are always welcome

## Adding a new file analyzer

1. Create `electron/analyzers/yourAnalyzer.ts`
2. Export a pure function: `analyze(content: string): Partial<AnalysisResult>`
3. Register it in `electron/analyzers/index.ts`
4. Add tests in `electron/analyzers/__tests__/yourAnalyzer.test.ts`

## Code style

- TypeScript strict mode — no `any`
- Functional style for analyzers — pure functions, no side effects
- `npm test` must pass before opening a PR

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
