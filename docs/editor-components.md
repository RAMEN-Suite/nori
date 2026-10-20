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

## Brand assets

- Preserve the supplied sources: `editor/public/images/nori-logo-clean.svg` for small displays and favicons, and `nori-logo-worn.svg` for large displays and desktop icons. `HomeScreen` uses the clean mark as a theme-aware mask; other screens retain their back controls.
- `icons/icon.icon` owns native macOS light/dark variants. Keep PNG, ICO and ICNS fallbacks consistent with it. Do not call `app.dock.setIcon` in a packaged app, because that replaces the native appearance variants. Development uses `icons/icon-mac.png`. See [Build and distribution](deployment.md) for platform prerequisites.
- `LogoIntroComponent` plays `editor/public/videos/nori-intro.webm` on the initial home route only. Preserve the supplied video timing. Returning from the workspace skips the intro; reduced motion, disabled animations and playback errors also reveal the home screen. Home animations resume when the video ends, with a short fade to the mounted content.
- `BrandIllustrationComponent` owns the home network and its ambient motion. Keep the circular portraits’ framing consistent with the landscape artwork. The desktop title bar owns the version display.

## Property workspace and resumable workflows

The property workspace uses one CDK overlay, backdrop and focus scope. `PropertyEditingService` owns opening, selection and navigation history; `PropertyEditorComponent` coordinates panels and decisions; `PropertyFormComponent` owns local draft fields and validation.

- Keep equal viewport insets, a fixed toolbar, aligned columns and internal scrolling with shared hints. The form host is a block so overflow measurements follow expanding groups. Shared height/entry animations respect motion preferences.
- Duplicate/remove sit on the left of the bottom action panel; save/discard sit on the right. Removal switches that panel to confirmation/cancel while the form remains visible and inert. Cancel preserves the form; successful removal selects the next property, then the previous one if necessary. Direct property constraints are removed with their owner.
- The Properties header starts a dedicated sorting mode after resolving any form draft. Use Sushi `OrderList` with stable property IDs and rich `NodeAttributeComponent` rows; Sushi owns drag previews, row movement, the handle menu, keyboard shortcuts and focus restoration. Translate its movement labels and announcements. Keep the order local until Save order persists it through workspace actions, preserving IDs and selection. Cancel restores the original order without writing. Saving immediately leaves sorting mode and temporarily makes the workspace inert without a disabled-state flash. A failed save restores the sorting draft for retry. Replace Create property with Cancel/Save order during sorting and lock the form and node navigation. Inherited order belongs to its declaring node.
- Own properties are editable; inherited/base properties are read-only. Group them by source model and keep stable IDs for rows. An inherited selection shows a separate yellow warning panel below the editing surface explaining that it cannot be edited here; its source chip opens the declaring node and the exact property in the same editor, preserving the return path. Inspector and editor share `NodeAttributeComponent` without nested interactive controls.
- Property changes stay local until Save succeeds. The separate action panel offers Save and Discard changes. Switching selection, closing or navigating with a draft requires an explicit decision in that same panel; invalid drafts remain visible with inline errors. A blocked transition briefly shakes the action panel on every attempt, respecting motion preferences. Save and Discard only resolve the draft and keep the current property open; blocked actions are never queued or resumed automatically. Block concurrent edits with `inert` during persistence while keeping the existing field and panel appearance; only the save control shows loading. Do not toggle every control into a disabled visual state for a brief save.
- New properties are drafts until saved. Duplication immediately persists and selects a copy with a free name, preserved settings and a cleared key flag. Resolve any existing draft before duplicating. Ignore asynchronous results after the editor is destroyed or its project, model, node or property changes. New/renamed names are limited to 40 characters; imported names remain intact and duplicate suffixes reserve space.
- Keep the key option visible. A node can have at most one key across its inheritance chain, and key bounds must be exactly `1..1`. Disable ineligible key controls with the existing key name or a required/single-value explanation. Show list bounds/order/duplicate settings only in multiple-value mode. Keep limits editable without collapsing their group; an empty maximum means unlimited. The Constraints tab remains a placeholder.
- `ShapeEditorComponent` shares the property workspace shell. Its left list drills from annotation shapes into shared/owned properties or relation rules; `PropertyFormComponent.shapeId` routes property saves through the shape actions. Inherited shapes and shared node properties are read-only. Shape edits validate a trial change and restore the workspace if persistence fails. Relation rules select existing edges and a combined cardinality; they do not create graph edges.
- Escape cancels sorting or removal confirmation first, otherwise closes the workspace; toolbar shortcuts stay blocked while it is open. Opening and resize motion respect reduced motion and the animation preference.

To make inspection resumable, call `RunningActionService.start` with project ID, icon, severity, translated title/hint and an async resume callback. Honour its abort signal before restoring UI. One action is active at a time; model writes invalidate it, while navigation and view preferences do not. Resume rechecks persisted revisions. Model changes must pass through `ProjectService` so invalidation remains consistent.

`RemovalReviewService` retains the confirmation route, selected consequence list and scroll position. The property workspace keeps an internal node-history stack: the refinement chip opens the ancestor in the same overlay, and Back restores the previous route and selected property. Resolve unsaved edits in the save panel before switching. The current card exits left and the ancestor enters from the right; Back reverses the motion and sits at the left of the top toolbar. During node transitions, suppress local panel and form motion so outgoing notices disappear with the whole card rather than animating again on the incoming node. Both directions respect reduced motion. This does not create a paused running action. Keep graph components independent of these restoration details.

## Runtime and verification notes

- There is no persistent automated scenario suite yet. Verify mutations, draft resolution, stale context and migrations with behavioural checks; builds alone do not cover these paths.
- CI checks lint, formatting, types and builds but still needs provisioning for the built sibling `../ramen-core`; see the README installation prerequisites.
- Home, project entry and workspace screens load through route-level dynamic imports. Keep their entry points lazy; the initial bundle and all component styles must stay within the existing budgets. Use shared layout utilities for structural styles and scoped CSS for component state, motion and responsive overrides.
- CommonJS imports in `short-unique-id`, `iwanthue`, ELK and the `json-schema-library` dependencies in Core are explicitly accepted in `angular.json`. Their installed distributions do not provide native ESM for these imports. Replacing them requires checks of ID compatibility, colour generation, graph layouts and schema validation. Default palettes are fixed values; load the palette generator only on demand. ELK calculations run in the shipped worker, terminated with the graph component.
- Desktop routes keep the absolute `index.html` entry URL through `DesktopLocationStrategy`. Relative fragment URLs resolve against the document's `./` base and can drop the entry file, breaking native reload. Browser routes retain their normal strategy.
- The desktop window stays hidden until the first activated route renders and signals readiness through the validated main-frame IPC bridge. Keep startup performance separate from intro timing.
