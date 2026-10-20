# Building and distributing Nori

Choose the target you want to build. This guide is for people building their own copy of Nori; using an existing browser installation or a provided desktop app does not require these tools.

Run the commands from the Nori repository root unless stated otherwise.

| Target                              | Build command             | Result                                    |
| ----------------------------------- | ------------------------- | ----------------------------------------- |
| Browser                             | `npm run build:editor`    | Web application in `dist/editor/browser/` |
| macOS, Apple Silicon — local test   | `npm run make:mac`        | Unsigned `.app` and ZIP                   |
| macOS, Apple Silicon — distribution | `npm run make:mac:signed` | Signed and notarized `.app` and ZIP       |
| Windows, x64                        | `npm run make:win`        | Unsigned `NoriSetup.exe` installer        |

## Prepare your machine

1. Install the Node.js version listed in `.nvmrc` and npm 11.16 or later within version 11.
2. Place the RAMEN Core repository next to Nori at `../ramen-core`. Nori currently uses that local package. In the Core directory, run `npm ci` and `npm run build`.
3. Back in Nori, install dependencies:

   ```sh
   npm ci
   ```

4. For a desktop build, also download the Electron runtime:

   ```sh
   npm run setup:electron
   ```

   This step is explicit because dependency install scripts are disabled in this project. Browser-only builds do not need the Electron runtime.

## Browser

To try Nori locally in a browser:

```sh
npm run start:editor
```

Open `http://localhost:4200`. This is the development server.

To create a production build:

```sh
npm run build:editor
```

The complete web application is written to **`dist/editor/browser/`**. Hand over that directory for web hosting, including its assets and worker files. Open the hosted application over HTTP(S), rather than opening `index.html` directly from the filesystem.

The default build uses a relative base path (`./`). If your hosting setup requires a specific path, pass the base path supplied by the person managing it, for example:

```sh
npm run build:editor -- --base-href /nori/
```

Projects and preferences are stored in the browser profile. The browser and desktop app use separate local storage; use JSON export/import to transfer a project between them.

## macOS

Build on a Mac with **macOS 26+ and Xcode 26+**. Apple's asset compiler is needed for the light/dark app icons. The current build targets **Apple Silicon (`arm64`)**.

For a local packaging test without Apple signing credentials:

```sh
npm run make:mac
```

For a build to distribute to other people, complete the signing setup below and run:

```sh
npm run make:mac:signed
```

Both commands build the application first. The results are:

- App: `out/Nori-darwin-arm64/Nori.app`
- ZIP: `out/make/zip/darwin/arm64/Nori-darwin-arm64-<version>.zip`

### One-time signing setup

1. Install Xcode and select its developer directory. Check `xcrun --find notarytool`.
2. Use an active Apple Developer Program membership to create or install a **Developer ID Application** certificate, including its private key, in the login keychain. Xcode's account settings provide certificate management. `Apple Development` is not the distribution identity for this ZIP.
3. Run `security find-identity -v -p codesigning` and copy the complete `Developer ID Application: … (TEAMID)` name. A certificate without its private key is insufficient.
4. Create an app-specific password in your Apple Account. Store notarization credentials interactively in Keychain, replacing the example Apple ID and Team ID:

   ```sh
   xcrun notarytool store-credentials nori-notary \
     --apple-id 'you@example.com' \
     --team-id 'YOUR_TEAM_ID'
   ```

   Enter the app-specific password at the password prompt. Keep it out of source files and shell history.

5. Create your local build configuration:

   ```sh
   cp .env.example .env.local
   ```

   In `.env.local`, replace the signing identity with the exact certificate name from step 3. The example bundle identifier is a proposal: choose the permanent identifier for your distribution and keep it consistent in subsequent releases. Passwords and private keys stay in Keychain; the file contains only build settings and the Keychain profile name.

6. Run `npm run make:mac:signed`. Node loads `.env.local` automatically; it is ignored by Git. Existing environment variables take precedence over the local file. If you previously exported placeholder values in your terminal, remove them with `unset NORI_MAC_BUNDLE_ID NORI_MAC_SIGN_IDENTITY NORI_MAC_NOTARY_PROFILE` before using the local file.

The signed command checks the required settings and signing identity before building. Forge signs with Hardened Runtime and the JIT entitlement, uploads the application to Apple's notarization service, and staples the accepted ticket before creating the ZIP. The script then verifies the resulting `.app` using `codesign`, `stapler` and Gatekeeper (`spctl`); any failed check fails the command. Apple processing times vary, so leave time for notarization and a test on the receiving Mac.

The packaged application includes built output, icons, production dependencies, package metadata and the license; repository source and local configuration are excluded. The unsigned and signed builds share the output directory: distribute only the ZIP produced by a successful signed run.

Before sending, extract the ZIP into a fresh folder, launch Nori, and check project creation/reopening, JSON import/export, image export, external links and window controls. Do not modify the signed application bundle afterwards. Use the complete ZIP rather than separately copying parts of the app.

## Windows

Build on a **Windows machine**. The current build targets **x64**.

```powershell
npm run make:win
```

The command builds Nori and creates the installer at:

```text
out/make/squirrel.windows/x64/NoriSetup.exe
```

Run `NoriSetup.exe` to install Nori, or share it with another Windows user. No purchased Windows code-signing certificate is required for this build. The installer is **unsigned**, so Windows may show an unknown-publisher warning or block it under device security policies. Apple Developer credentials do not apply to Windows.

## Check and update a build

Before sharing a build, run:

```sh
npm run verify
```

Test the resulting browser build or desktop app: create and reopen a project, import/export JSON, export an image and check graph layout. Windows installation must be tested on Windows.

To update an installed desktop copy, quit Nori and replace the macOS app or run the newer Windows installer. Export important projects as JSON before updating. Automatic updates are not configured.

## References

- [Apple Developer ID certificates](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/)
- [Electron Forge macOS signing](https://www.electronforge.io/guides/code-signing/code-signing-macos)
- [Microsoft SmartScreen reputation](https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation)
