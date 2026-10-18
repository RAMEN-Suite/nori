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

## Packaging

Package the application:

```
npm run package
```

Create distributable installers:

```
npm run make
```

Both commands automatically build the Angular editor and Electron process before packaging. They target the host architecture by default; use `npm run make -- --arch x64` to select another architecture. Builds create local artifacts; automated publishing is not configured.

### Local macOS builds (Apple Silicon)

```sh
npm run make:mac         # unsigned local packaging check
npm run make:mac:signed  # Developer ID signing, notarization and verification
```

These commands build `arm64` on macOS and create a ZIP in `out/make/zip/darwin/arm64/`. They do not publish a GitHub release. Send the signed ZIP to a colleague; the unsigned command is only for local testing. Signing and notarization use Forge's existing packaging lifecycle, so the same configuration can later run on a macOS CI worker.

One-time setup for signed distribution:

1. Install Xcode and select its developer directory. Check `xcrun --find notarytool`.
2. Use an active Apple Developer Program membership to create or install a **Developer ID Application** certificate, including its private key, in the login keychain. Xcode's account settings provide certificate management. `Apple Development` is not the distribution identity for this ZIP.
3. Run `security find-identity -v -p codesigning` and copy the complete `Developer ID Application: … (TEAMID)` name. A certificate without its private key is insufficient.
4. Create an app-specific password in your Apple Account. Store notarization credentials interactively in Keychain, replacing the example Apple ID and Team ID:

   ```sh
   xcrun notarytool store-credentials nori-notary \
     --apple-id 'you@example.com' \
     --team-id 'YOUR_TEAM_ID'
   ```

   Enter the app-specific password at the password prompt. Do not put it in source files, shell history or chat.

5. Set the following nonsecret build settings in the terminal that runs the build:

   ```sh
   export NORI_MAC_BUNDLE_ID='org.ramen-suite.nori'
   export NORI_MAC_SIGN_IDENTITY='Developer ID Application: YOUR NAME (YOUR_TEAM_ID)'
   export NORI_MAC_NOTARY_PROFILE='nori-notary'
   npm run make:mac:signed
   ```

   The bundle identifier above is a proposed example: choose the permanent identifier for your distribution and keep it consistent in subsequent releases. The signing identity must exactly match your keychain certificate.

The signed command checks the required settings and signing identity before building. Forge signs with Hardened Runtime and the JIT entitlement, uploads the application to Apple's notarization service, and staples the accepted ticket before creating the ZIP. The script then verifies the resulting `.app` using `codesign`, `stapler` and Gatekeeper (`spctl`); any failed check fails the command. Apple processing times vary, so leave time for notarization and a test on the receiving Mac.

The packaged application includes built output, icons, production dependencies, package metadata and the license; repository source and local configuration are excluded. The unsigned and signed builds share the output directory: distribute only the ZIP produced by a successful signed run.

Before sending, extract the ZIP into a fresh folder, launch Nori, and check project creation/reopening, JSON import/export, image export, external links and window controls. Do not modify the signed application bundle afterwards. Use the complete ZIP rather than separately copying parts of the app.

References: [Apple Developer ID certificates](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/), [Electron Forge macOS signing](https://www.electronforge.io/guides/code-signing/code-signing-macos), [notarization credentials in Keychain](https://github.com/electron/notarize#usage-with-keychain-credentials).

### Local Windows builds

On Windows, run `npm run make:win` to build the editor and Electron process, then create an unsigned x64 installer at `out/make/squirrel.windows/x64/NoriSetup.exe`. The command requires Windows and fails before building on other hosts. The Squirrel maker and startup event handling are already configured. Windows code signing is a separate setup; Apple credentials do not sign Windows installers.

---

## Editor maintenance

- [Coding conventions](docs/coding-conventions.md): code style, types, async work and verification.
- [Editor guide](docs/editor-components.md): architecture, ownership and extension paths.
- [UI guidelines](docs/ui-guidelines.md): panels, dialogs, lists and Sushi integration.

---

## License

Copyright 2026 Sebastian Enns, TH Mittelhessen

Licensed under the **Apache License, Version 2.0** (the "License");  
you may not use this file except in compliance with the License.

You may obtain a copy of the License at:

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an **"AS IS" BASIS**, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
