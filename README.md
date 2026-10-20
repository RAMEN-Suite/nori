# Nori – A Model Layering Tool

Nori is a tool for **multi-level modelling of objects across heterogeneous domains**, developed for use in domains such as the **Digital Humanities**.

It can be used both as:

- a **web-based editor** (Angular)
- a **desktop application** via Electron

## Documentation

- [Build and distribution](docs/deployment.md): build Nori for the browser, macOS or Windows, including local macOS signing setup.
- [Coding conventions](docs/coding-conventions.md): code style, types, async work and verification.
- [Editor guide](docs/editor-components.md): architecture, ownership and extension paths.
- [UI guidelines](docs/ui-guidelines.md): panels, dialogs, lists and Sushi integration.

---

## Installation

### Requirements

- Node.js 26.3 or later within version 26 (`.nvmrc`)
- npm 11.16 or later within version 11
- The sibling repository `../ramen-core` with a built `@ramen-suite/core` package.

Install dependencies and run `npm run build` in `../ramen-core` first. Then install Nori dependencies:

```
npm install
npm run setup:electron
```

Install scripts are disabled in `.npmrc`. `setup:electron` explicitly downloads the Electron executable; the desktop start command also checks it automatically.

---

## Running (Development)

Start the full development environment:

```
npm start
```

This will:

1. Ensure the Electron executable is installed
2. Build the Electron process
3. Start the Angular editor development server
4. Wait for the editor to be available
5. Launch the Electron application

Closing Electron also stops the development server.

The Angular editor dev server runs at:

http://localhost:4200

For access from another device on the same network, use `npm run start:network`.

If you only want to run the editor:

```
npm run start:editor
```

---

## Building

Build both parts with `npm run build`. Build the Angular editor separately:

```
npm run build:editor
```

Build the Electron process:

```
npm run build:electron
```

---

## Checks

```sh
npm run verify
```

The editor build also checks Angular templates. Automated scenario tests will follow the migration.

## Distribution

```sh
npm run make:mac         # unsigned Apple Silicon test build, on macOS
npm run make:mac:signed  # signed and notarized Apple Silicon build, on macOS
npm run make:win         # unsigned Windows x64 installer, on Windows
```

See [Build and distribution](docs/deployment.md) for prerequisites, platform-specific steps and output paths.

---

## License

Copyright 2026 Sebastian Enns, TH Mittelhessen

Licensed under the **Apache License, Version 2.0** (the "License");  
you may not use this file except in compliance with the License.

You may obtain a copy of the License at:

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an **"AS IS" BASIS**, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
