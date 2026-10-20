# Nori

A browser and desktop editor for multi-level modelling across heterogeneous domains, including the Digital Humanities. The editor uses Angular and Sushi; the desktop application uses Electron.

## Documentation

- [Build and distribution](docs/deployment.md): prerequisites and browser, macOS and Windows builds.
- [Coding conventions](docs/coding-conventions.md): code style, types, async work and verification.
- [Editor guide](docs/editor-components.md): architecture, ownership and extension paths.
- [UI guidelines](docs/ui-guidelines.md): shared layouts, interaction and accessibility.
- [Sushi feedback](docs/sushi-feedback.md): unresolved library issues and proposals.

## Development

Use the Node.js version in [`.nvmrc`](.nvmrc) and npm requirements in [`package.json`](package.json). Nori currently depends on a built sibling checkout at `../ramen-core`; install its dependencies and build it first.

```sh
npm ci
npm start
```

`npm start` prepares Electron, builds the desktop process and starts the editor and desktop app. Closing Electron stops the development server. Dependency install scripts are disabled in `.npmrc`; the start command explicitly prepares the Electron runtime.

For browser development, use `npm run start:editor` and open `http://localhost:4200`. Use `npm run start:network` for another device on the same network.

## Verification

```sh
npm run verify
```

This runs lint, formatting, TypeScript checks and both builds, including Angular templates. Behavioural verification is still required for changed workflows; there is no automated scenario suite yet.

For production builds and desktop packaging, follow [Build and distribution](docs/deployment.md).

## License

Copyright 2026 Sebastian Enns

Licensed under the **Apache License, Version 2.0** (the "License");  
you may not use this file except in compliance with the License.

You may obtain a copy of the License at:

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an **"AS IS" BASIS**, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
