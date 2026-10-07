# NORI – A Model Layering Tool


NORI is a tool for **multi-level modelling of objects across heterogeneous domains**, developed for use in domains such as the **Digital Humanities**.

It can be used both as:

- a **web-based editor** (Angular)
- a **desktop application** via Electron

---

## Installation

### Requirements

- Node.js (LTS recommended)
- npm
- Das Geschwister-Repository `../ramen-core` mit gebautem Paket `@ramen-suite/core`.

Zuerst im Geschwisterordner `ramen-core` die Abhängigkeiten installieren und `npm run build` ausführen. Danach hier die Abhängigkeiten installieren:
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

## License

Copyright 2026 Sebastian Enns, TH Mittelhessen

Licensed under the **Apache License, Version 2.0** (the "License");  
you may not use this file except in compliance with the License.

You may obtain a copy of the License at:

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an **"AS IS" BASIS**, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
