# Code conventions

This is Nori's project supplement to the reusable [TypeScript conventions](typescript-conventions.md). Read the baseline for naming, types, control flow, async work, errors, tests, security and library APIs. This supplement defines the framework and domain choices for this repository. The [code-style review](code-style-review.md) records the evidence and current gaps behind these rules.

The compiler, ESLint, Prettier and Commitlint configurations enforce mechanical rules. Keep them and these documents consistent. Existing application-specific choices are not requirements for every library.

## Structure

- Prefer the simplest explicit solution. Avoid speculative abstractions, hidden state, tightly coupled components and duplicated rules (KISS; avoid STUPID design).
- Group code by responsibility: imports, types, component metadata, dependencies, inputs/outputs, state, lifecycle, user actions, private helpers. Use clear names instead of section comments.
- Keep Angular imports first, external libraries next, project imports last. Keep all imports above declarations. Remove unused and duplicate dependencies.
- Components own presentation and interaction. Workspace store/queries/actions own model state, derived data and mutations. Project state belongs to ProjectService and database operations to ProjectRepositoryService; RAMEN Core owns schema rules.
- Extract a component or class when it owns a coherent behaviour, not merely to shorten a file. Prefer small typed APIs over generic components with many modes.

## Folder responsibilities

Keep the separation between `view`, `services`, `models`, `states`, `directives`, `guards` and `utils`. Group related UI components within `view/components`:

| Component directory | Contents                                                                                |
| ------------------- | --------------------------------------------------------------------------------------- |
| `projects/`         | Project forms, entry illustrations and shared entry styles                              |
| `workspace/`        | Catalogue, graph, inspector, model levels, validation, property editing and toolbar     |
| `dialogs/`          | Dialog components and their inner content                                               |
| `shell/`            | Title bar, footer, global dialog host, settings button and running-action notification  |
| `shared/`           | Reusable UI independent of an individual feature, such as panel frames and scroll hints |

`view/screens` contains the complete application views: `home`, `project-entry` and `workspace`. Each screen, component and dialog has its own directory containing its TypeScript, template and component styles. Keep private child components in their own directories beneath their owner, such as `property-editor/property-form` and `confirmation/confirmation-content`.

Services are grouped by the behaviour they own:

| Service directory      | Responsibility                                             |
| ---------------------- | ---------------------------------------------------------- |
| `projects/`            | Project state and atomic project/model database operations |
| `persistence/`         | JSON preferences and file export                           |
| `interaction/`         | Dialog lifecycle, navigation and keyboard shortcuts        |
| `workspace/model/`     | Model mutations, derived queries and relation history      |
| `workspace/editing/`   | Graph tools, node, relationship and property editing       |
| `workspace/workflows/` | Pausing and resuming actions, including removal inspection |

Keep these boundaries explicit: workspace actions change and save models; editing services coordinate UI workflows; relation history owns undo/redo snapshots. `WorkspaceService` is the common entry point to state, queries and actions. Each service has a short responsibility comment above `@Injectable`; describe what it owns rather than repeating its name. Avoid extra folders for individual services or merging services merely because they share callers.

Workspace services stay grouped under `services/workspace`; `WorkspaceStore` belongs in `states`. Keep view-specific helpers with their owner, such as graph data preparation with the graph. Put pure model helpers in `utils`, including import ordering, model queries, names, colours and removal summaries. Reserve `services` for application services; keep state containers in `states`. Do not add a `core` wrapper without a distinct responsibility.

`models` contains data contracts for projects, model records, appearance and confirmation messages. Translation registration and language matching belong in `i18n/languages.ts`; shortcut definitions and keyboard helpers belong in `utils/shortcuts/definitions.ts` and `utils/shortcuts/bindings.ts`.

To add a language, extend `TranslationLanguage` in `i18n/languages.ts`, import its bundled JSON and register it in `Languages.translations`. TypeScript requires a translation entry for each supported language. Add its `settings.languageOptions` label to the translation files; loader selection, Transloco configuration and the settings options follow the registry.

Use `levelIndex` for NORI’s ordered model position and model IDs for Core identities. Core’s `openLevel(modelId)` selects a model by identity; a level index is not its inheritance depth. Keep legacy storage names confined to database migrations.

## Angular naming

- Use one project prefix: `nori-*` for component selectors and `nori` with camelCase for directive selectors, such as `noriTooltip`. Sushi components keep their public `sui` prefix.
- Use `Screen` for a complete application view that composes its areas. A routed inspector or other nested view is not automatically a screen. Keep the existing `.screen.ts` file convention for these views.
- Use `Dialog` and `.dialog.ts` for components opened as dialogs. Inner dialog components retain names describing their own task.
- Name other components after their concrete responsibility, such as `ProjectOpenComponent` or `NodeAttributesComponent`. Do not encode categories such as `block` or `shared` in selector prefixes.
- Group related code by feature. Reserve `shared` for reusable UI independent of an individual feature.
- Angular ESLint enforces the project prefix and selector casing; Angular generators use the same prefix.

## Angular and types

- Use standalone OnPush components, signal inputs/outputs/state, computed derived state, inject and host metadata.
- Separate class dependencies, mutable state, public signals and derived queries with blank lines. Keep related fields together without section comments.
- TypeScript rejects unused locals and parameters. Check template bindings, framework callbacks and dynamic translation keys before removing declarations.
- Follow ESLint: explicit member visibility, variable/parameter types and function return types; readonly references where appropriate. Avoid any, unchecked casts and non-null assertions.
- Use effects for external synchronisation, not a second copy of derived state. Clean up observers, listeners, timers and subscriptions.
- Guard pending actions, stale selections and model changes. Validate a trial change before mutating live model data.
- Use semantic HTML and accessible labels. Keep focus visible and preserve keyboard navigation. Translate user-facing text into every registered language.

### Visibility and state

- Use `public` for component inputs, outputs and APIs called by other code; use `protected` for template-bound state and event handlers; use `private` for implementation details.
- Mark injected dependencies and signal references `readonly`. Prefer private writable signals with a readonly public view; expose writable state only when the facade deliberately allows callers to change it.
- Use `computed` for derived state. Effects synchronise external state or imperative APIs; they should not maintain a duplicate computed value.
- Keep inputs, mutable state and derived queries recognisable through grouping and names. Contextually typed arrow parameters may use inference; other annotations follow ESLint.
- The current maintainability thresholds are complexity 12 and 40 nonblank, noncomment lines per function. Extract meaningful operations to meet them; do not create trivial wrappers merely to satisfy a number.
- Use `as const` to preserve literals where useful. Avoid casts that pretend external data is already valid. Framework-initialised storage fields are a deliberate definite-assignment exception.

### Templates and styles

- Keep templates responsible for presentation. Put domain decisions in Core or workspace queries/actions, and substantial event workflows in editing services.
- Use Angular's current control-flow syntax and stable tracking identities for changing lists. Keep expensive transformations out of repeated template evaluation.
- Use native buttons for actions and links for navigation, including an accessible name for icon-only controls. Decorative icons should not add duplicate announcements.
- Keep noninteractive group headings noninteractive. Do not turn a list into nested buttons or rely on hover as the only way to reach an action.
- Use Sushi's public tokens and APIs. Share structural styles with the existing panel/dialog/list owners; keep feature-specific styles local.
- Avoid `::ng-deep`, `!important` and selectors into private Sushi markup. Fix a missing capability in the owning component or document an upstream issue.
- Direct DOM and D3 access belongs in the graph renderer, element-owning directives or another explicit integration boundary. Clean up everything created there.
- Follow [dialog design](dialog-design.md) for titles, content, actions, focus, scrolling and motion. Respect reduced motion for shared animations as well as feature animations.

## Model operations and async workflows

- RAMEN Core is authoritative for schema validation, property rules, constraints and qualified references. Do not maintain a second validator in a component.
- Use workspace queries for reads and actions for mutations. Editing services coordinate forms, dialogs and selection; they may depend on those UI contracts because they are application workflows.
- Validate a proposed model operation before changing the live model. Keep failure feedback connected to the originating form or action.
- Keep `ProjectService` responsible for selected project state and `ProjectRepositoryService` responsible for atomic database access and migrations.
- Distinguish the database record ID, Core model ID, qualified element reference and ordered `levelIndex`. Never substitute an array position for identity.
- Capture workspace context before awaiting. Check project/model identity or a revision/token before applying the result. A user may change projects or selection while a dialog or save is pending.
- Serialise conflicting saves and preserve newer input while a save runs. A pending flag alone does not establish write order.
- Use the existing relation-history owner for undo/redo. Preserve its snapshot and context checks; keep unrelated UI workflows out of it.
- Keep running actions and removal review in their workflow owners. Cancellation, model changes and returning from graph inspection must not revive an obsolete action.
- Treat imported JSON and stored preferences as unknown until parsed and validated. Keep legacy storage names inside migrations.

## UI and extensions

- Build on public Sushi components, APIs and tokens. Share panel/dialog frames, list spacing and tooltips. Avoid private DOM selectors and one-off behaviour in consumers.
- Keep forms, lists and actions together by task. Show validation next to its field or form. Never nest editing dialogs.
- Prefer a short class or directive responsibility comment. Express method intent through names; put extension guidance and non-obvious workflow constraints in this documentation rather than inline narration.
- See [Editor components](editor-components.md) for extension points and [Dialog design](dialog-design.md) for presentation rules.

## Verification and commits

- Run lint, formatting, type checks and Angular compilation. Check changed UI with mouse, keyboard, scrolling and reduced motion; test model rules with meaningful scenarios.
- Add tests for behaviour that can regress, not for trivial reversible styling. Stop expanding checks when the concrete risk is covered.
- Keep commits coherent. Use `type(scope): description`, with scopes defined in commitlint.config.cjs. Validate every commit with Commitlint.

### Tooling source of truth

| Concern                | Configuration or command                                               |
| ---------------------- | ---------------------------------------------------------------------- |
| Node version           | `.nvmrc`; compatible ranges in `package.json`                          |
| Formatting             | `.prettierrc`, `.editorconfig`, `.prettierignore`; `npm run format`    |
| TypeScript             | `angular-tsconfig.json` and the editor, Electron and tooling tsconfigs |
| Lint                   | `eslint.config.mjs`; `npm run lint`                                    |
| Type checks            | `npm run typecheck`                                                    |
| Production compilation | `npm run build`                                                        |
| Combined local gate    | `npm run verify`                                                       |
| Commit messages        | `commitlint.config.cjs`, `.githooks/commit-msg`                        |

Use the local dependencies and lockfile. Installation expects a built sibling `../ramen-core`; see the README. Do not silently enable all install scripts to resolve a dependency setup problem.

Nori uses scopes `editor`, `desktop`, `tools`, `deps` and `release`. Examples: `fix(editor): preserve property edits during save` and `docs(editor): document component extension points`. Use a concrete description; declare incompatible public changes when relevant.

The local verification command is a required development check. CI currently allows the format step to fail and does not provision the sibling Core package; these are recorded gaps, not guarantees that the full gate is enforced remotely. There is currently no automated scenario-test command.

## Adding or changing a feature

1. Find the owner in [Editor components](editor-components.md). Extend an existing owner when the responsibility already exists.
2. Put domain rules in Core, reads in workspace queries, mutations in workspace actions and UI coordination in editing/workflow services.
3. Define typed inputs and outputs for presentation components. Keep child components with their feature until genuinely reusable.
4. Use the registered shortcut definitions and binding helpers for new hotkeys; include a translated label and check collisions and input-field behaviour.
5. Add user-facing text to every registered language. Check dynamic translation keys before deleting apparently unused entries.
6. Cover the relevant model, persistence or async failure scenario. Verify changed UI with keyboard, focus, long text, scrolling and reduced motion where applicable.
7. Run the local verification gate and update the extension documentation when ownership or public APIs change.

## Intentional differences from generic guidance

- Nori keeps role folders such as `view`, `services` and `states`, with feature groups inside them. Do not reorganise them solely because another guide demonstrates a different folder tree.
- Component, service, dialog and screen suffixes remain useful navigation cues here. Contract files in `models` and existing Electron files retain their established PascalCase names.
- Explicit local types and member visibility are adopted author preferences. They are not a claim that inferred TypeScript is unsafe.
- Root Angular services are legitimate application lifecycle owners. Avoiding hidden singletons does not prohibit framework-managed dependency injection.
- The graph has an imperative renderer with dedicated geometry, layout, viewport and export helpers. A large orchestration component is reviewed by responsibility rather than split by arbitrary line count.
- These conventions do not make Nori a publishable domain library. For a new library, apply the baseline's runtime, exports and compatibility requirements separately.
