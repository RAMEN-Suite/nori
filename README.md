# Nori – A Model Layering Tool

Nori is a tool for **multi-level modelling of objects across heterogeneous domains**, developed for use in domains such as the **Digital Humanities**.

It can be used both as:

- a **web-based editor** (Angular)
- a **desktop application** via Electron

---

## Installation

### Requirements

- Node.js 26.3 or later within version 26 (`.nvmrc`)
- npm 11.16 or later within version 11
- The sibling repository `../ramen-core` with a built `@ramen-suite/core` package.

Install dependencies and run `npm run build` in `../ramen-core` first. Then install Nori dependencies:

```
npm install
```

---

## Running (Development)

Start the full development environment:

```
npm run start:electron
```

This will:

1. Build the Electron process
2. Start the Angular editor development server
3. Wait for the editor to be available
4. Launch the Electron application

The Angular editor dev server runs at:

http://localhost:4200

If you only want to run the editor:

```
npm run start:editor
```

---

## Building

Build the Angular editor:

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
npm run lint
npm run typecheck
npm run format
npm run build:editor
npm run build:electron
```

The editor build also checks Angular templates. Automated scenario tests will follow the migration.

## Packaging

Package the application:

```
npm run package
```

Create distributable installers:

```
npm run make
```

Both commands automatically build the Angular editor and Electron process before packaging.

---

## Editor maintenance

Start with [code conventions](docs/code-conventions.md) and [dialog design](docs/dialog-design.md). See [the component and extension guide](docs/editor-components.md) for component responsibilities, adding hotkeys and the recommended next refactoring boundaries.

---

## License

Copyright 2026 Sebastian Enns, TH Mittelhessen

Licensed under the **Apache License, Version 2.0** (the "License");  
you may not use this file except in compliance with the License.

You may obtain a copy of the License at:

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an **"AS IS" BASIS**, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
