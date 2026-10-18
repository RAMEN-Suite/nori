# Editor guide

Start with [Coding conventions](coding-conventions.md) and [UI guidelines](ui-guidelines.md). Paths below are relative to `editor/src/app` unless stated otherwise.

## Structure and owners

Keep `view`, `services`, `states`, `models`, `directives`, `guards` and `utils` separate. Group features within those roles. `view/screens` composes complete application views; `view/components` groups projects, workspace features, dialogs, shell and shared UI. Keep private children beneath their feature; move them to shared only when genuinely reusable.

| Responsibility                       | Owner                                                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Schema rules and model validation    | RAMEN Core                                                                                                                        |
| Workspace state, reads and mutations | `WorkspaceStore`, `WorkspaceQueriesService`, `WorkspaceActionsService`; accessed through `WorkspaceService.store/queries/actions` |
| Project selection and persistence    | `ProjectService`, `ProjectRepositoryService`, `AppDatabase` migrations                                                            |
| Node/relation/property workflows     | Editing services under `services/workspace/editing`                                                                               |
| Resumable actions and removal review | `RunningActionService`, `RemovalReviewService`                                                                                    |
| Navigation, dialogs and shortcuts    | Services under `services/interaction`                                                                                             |
| Panel placement and canvas space     | `WorkspaceScreen`                                                                                                                 |
| Shared panel and scroll behaviour    | `EditorPanelComponent`, `ScrollOverflowDirective`, `ScrollHintsComponent`                                                         |
| Graph rendering and interaction      | `GraphComponent`, `GraphRenderer`, `GraphViewport`, layout/geometry/export helpers                                                |
| Property workspace                   | `PropertyEditingService`, `PropertyEditorComponent`, `PropertyFormComponent`                                                      |
| Inspector                            | Node/relation views and attribute components                                                                                      |
| Languages and pure helpers           | `i18n/languages.ts`, `utils`, `utils/shortcuts`                                                                                   |

`services/projects` owns projects; `services/persistence` owns file export and preferences; `services/workspace/model` owns workspace actions, queries and history. State containers belong in `states`; data contracts in `models`. Use small pure helpers such as `groupBy` for shared collection operations. Do not duplicate Core rules in components.

## Following and adding a model operation

1. Start at the component handler. Use an editing service when dialogs, selection or a multistep workflow are involved.
2. Put model mutations in `WorkspaceActionsService`, derived UI data in queries and state-independent calculations in model helpers. Use the corresponding Core API and validate a trial change before mutation.
3. Persist through `saveWorkspace` and `ProjectService`; the repository owns atomic database operations. Add database changes as versioned migrations in `AppDatabase`.
4. Capture workspace context before awaiting and verify it before applying results. `WorkspaceService.isCurrent` checks project and model together.
5. Add translations and verify the relevant success, validation, stale-context and persistence paths.

**Identities are different:** `record.modelId` is the IndexedDB record key, `record.gmodel.id` is the Core model identity, `levelIndex` is Nori's ordered display position, and qualified references identify declarations across models. A level index is not inheritance depth. Keep legacy storage names inside migrations.

## Adding a hotkey or language

For a hotkey:

1. Extend `ShortcutAction` and `SHORTCUT_DEFINITIONS` in `utils/shortcuts/definitions.ts`; use the binding helpers.
2. Connect execution in `ToolBarComponent.actions`, keeping the same pending/editability guards as the visible action.
3. Add labels in every registered language. Use `ShortcutService.display/aria`; do not repeat default bindings in templates.
4. Check reassignment, collisions, reload/reset and execution in text inputs, dialogs and the property workspace. Escape and Tab remain reserved during capture.

Bindings use lowercase keys, for example `shift+r` or `mod+z`; `mod` means Control or Command. `ShortcutService` owns resolution and persistence, Settings owns capture, and the toolbar executes actions.

For a language, extend `TranslationLanguage` and `Languages.translations` in `i18n/languages.ts`, import its JSON and add the language-option label in all translations. Registration drives loading and Settings options. Check dynamic keys before deleting apparently unused strings.

## Adding UI or graph behaviour

- Build panels with `EditorPanelComponent`; let `WorkspaceScreen` own placement, animation and occupied graph space. Open ordinary dialogs through `DialogService`, reusing pending/error state.
- Place the actual scrolling element and `ScrollHintsComponent` in one `nori-scroll-frame` cell. `ScrollOverflowDirective` owns overflow measurement and observes direct content children.
- Keep Base Nodes and Refinements separate because their data and actions differ; share visual primitives rather than a component with many modes.
- Add SVG drawing to `GraphRenderer`, geometry/layout to their helpers and viewport behaviour to `GraphViewport`. Keep editing rules in Core and editing services. Check fit and saved viewport with panels open and closed.
- Use `NavigationService` for node/relation navigation; do not write selection signals directly from graph elements. Node and relation selection clear each other.
- `GraphImageExport` prepares SVG/PNG independently of zoom and panels; `ExportService` owns saving images and JSON. Keep rasterisation and file dialogs separate from SVG preparation.

## Property workspace and resumable workflows

The property workspace uses a CDK overlay with one backdrop and focus scope. The service owns opening/selection; the editor coordinates the property list, detail view and navigation; the form owns fields, serialised saves and validation.

- Own properties are editable; inherited/base properties are read-only. Group them by source model and keep stable IDs for rows. Inspector and editor share `NodeAttributeComponent` without nested interactive controls.
- Switches and types save immediately; names and bounds commit on blur or Enter. Preserve newer drafts while saves complete. Commit before changing selection, closing or navigating; invalid drafts reset to the last valid model values without a discard dialog.
- New properties receive a free provisional name. Duplication preserves settings and clears the key flag. New/renamed names are limited to 40 characters; imported names remain intact and duplicate suffixes reserve space.
- Show list bounds/order/duplicate settings only in multiple-value mode. Keep limits editable without collapsing their group; an empty maximum means unlimited. Annotation/constraint tabs are placeholders, not implemented capabilities.
- Escape closes the workspace; toolbar shortcuts stay blocked while it is open. Opening and resize motion respect reduced motion and the animation preference.

To make inspection resumable, call `RunningActionService.start` with project ID, icon, severity, translated title/hint and an async resume callback. Honour its abort signal before restoring UI. One action is active at a time; model writes invalidate it, while navigation and view preferences do not. Resume rechecks persisted revisions. Model changes must pass through `ProjectService` so invalidation remains consistent.

`RemovalReviewService` retains the confirmation route, selected consequence list and scroll position. The property workspace keeps an internal node-history stack: the refinement chip opens the ancestor in the same overlay, and Back restores the previous route and selected property. Commit valid edits before switching. The current card exits left and the ancestor enters from the right; Back reverses the motion and sits at the upper left of the backdrop. Both directions respect reduced motion. This does not create a paused running action. Keep graph components independent of these restoration details.

## Known limits

- There is no persistent automated scenario suite yet. Prioritise mutations, invalid names/key conflicts, queued edits, stale context, undo/redo and migrations.
- CI checks lint, formatting, types and builds but still needs provisioning for the built sibling `../ramen-core`; see the README installation prerequisites.
- Existing style-budget, CommonJS and sibling Core side-effect warnings remain. Review large graph/property owners by responsibility when extending them, rather than splitting them by line count.
