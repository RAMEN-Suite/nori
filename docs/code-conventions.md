# Code conventions

## Structure

- Prefer the simplest explicit solution. Avoid speculative abstractions, hidden state, tightly coupled components and duplicated rules (KISS; avoid STUPID design).
- Group code by responsibility: imports, types, component metadata, dependencies, inputs/outputs, state, lifecycle, user actions, private helpers. Use clear names instead of section comments.
- Keep Angular imports first, external libraries next, project imports last. Keep all imports above declarations. Remove unused and duplicate dependencies.
- Components own presentation and interaction. Workspace store/view/actions own model state, derived data and mutations. Persistence belongs to StorageService; RAMEN Core owns schema rules.
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

Workspace services stay grouped under `services/workspace`; `WorkspaceStore` belongs in `states`. Keep view-specific helpers with their owner, such as graph data preparation with the graph. Put pure model helpers in `utils`, including import ordering, names, colours and removal summaries. Reserve `services` for application services; keep state containers in `states`. Do not add a `core` wrapper without a distinct responsibility.

`models` contains data contracts for projects, model records, appearance and confirmation messages. Translation registration and language matching belong in `i18n/languages.ts`; shortcut definitions and keyboard helpers belong in `utils/shortcuts.ts`.

To add a language, extend `TranslationLanguage` in `i18n/languages.ts`, import its bundled JSON and register it in `Languages.translations`. TypeScript requires a translation entry for each supported language. Add its `settings.languageOptions` label to the translation files; loader selection, Transloco configuration and the settings options follow the registry.

## Angular naming

- Use one project prefix: `nori-*` for component selectors and `nori` with camelCase for directive selectors, such as `noriTooltip`. Sushi components keep their public `sui` prefix.
- Use `Screen` for a complete application view that composes its areas. A routed inspector or other nested view is not automatically a screen. Keep the existing `.screen.ts` file convention for these views.
- Use `Dialog` and `.dialog.ts` for components opened as dialogs. Inner dialog components retain names describing their own task.
- Name other components after their concrete responsibility, such as `ProjectOpenComponent` or `NodeAttributesComponent`. Do not encode categories such as `block` or `shared` in selector prefixes.
- Group related code by feature. Reserve `shared` for reusable UI independent of an individual feature.
- Angular ESLint enforces the project prefix and selector casing; Angular generators use the same prefix.

## Angular and types

- Use standalone OnPush components, signal inputs/outputs/state, computed derived state, inject and host metadata.
- TypeScript rejects unused locals and parameters. Check template bindings, framework callbacks and dynamic translation keys before removing declarations.
- Follow ESLint: explicit member visibility, variable/parameter types and function return types; readonly references where appropriate. Avoid any, unchecked casts and non-null assertions.
- Use effects for external synchronisation, not a second copy of derived state. Clean up observers, listeners, timers and subscriptions.
- Guard pending actions, stale selections and model changes. Validate a trial change before mutating live model data.
- Use semantic HTML and accessible labels. Keep focus visible and preserve keyboard navigation. Translate user-facing text into every registered language.

## UI and extensions

- Build on public Sushi components, APIs and tokens. Share panel/dialog frames, list spacing and tooltips. Avoid private DOM selectors and one-off behaviour in consumers.
- Keep forms, lists and actions together by task. Show validation next to its field or form. Never nest editing dialogs.
- Comments explain a necessary constraint or surprising behaviour only. Do not narrate what the code already says.
- See [Editor components](editor-components.md) for extension points and [Dialog design](dialog-design.md) for presentation rules.

## Verification and commits

- Run lint, formatting, type checks and Angular compilation. Check changed UI with mouse, keyboard, scrolling and reduced motion; test model rules with meaningful scenarios.
- Add tests for behaviour that can regress, not for trivial reversible styling. Stop expanding checks when the concrete risk is covered.
- Keep commits coherent. Use `type(scope): description`, with scopes defined in commitlint.config.cjs. Validate every commit with Commitlint.
