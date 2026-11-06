# Contributing to Nori

Use the Node.js version in [`.nvmrc`](.nvmrc) and npm version in [`package.json`](package.json). Install from the lockfile.

```sh
npm ci
npm run start:editor
```

Open http://localhost:4200 for browser development. Run `npm start` when working on desktop behaviour. That command prepares Electron explicitly because install scripts are disabled. RAMEN Core and Sushi are installed from npm.

## Find the owner of a change

Start with the [component map](docs/architecture.md). Keep changes within the layer that owns the behaviour and follow the [coding conventions](docs/coding-conventions.md). For example, put a model edit in the workspace command service and keep the form responsible for collecting input and reporting field errors.

## Verify and submit

Run `npm test` for the Angular suite or `npx ng test editor --include="**/property-form.component.spec.ts"` for one spec. Keep specs next to the code they exercise. Use Angular TestBed for injected services and rendered components, and test the public behaviour that could regress. Run `npm run verify` for lint, formatting, type checks, tests and builds. Exercise changed UI flows with keyboard navigation and check persistence or cancellation where the change affects them.

Keep each commit focused. Commitlint checks Conventional Commits with a scope of `editor`, `desktop`, `tools`, `deps` or `release`. Run `npm run prepare` to configure the repository hook if needed. In a pull request, describe the user-visible change, how to reproduce it and what you verified.
