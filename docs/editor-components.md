# Editor guide

[Features and behaviour](features.md) is the functional contract. [UI guidelines](ui-guidelines.md) defines presentation; [Coding conventions](coding-conventions.md) defines implementation style. Paths below are relative to `editor/src/app` unless stated otherwise.

## Owners

| Responsibility                               | Owner                                                                             |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| Schema, references and model semantics       | RAMEN Core                                                                        |
| Project selection and local records          | `ProjectService`, `ProjectRepositoryService`, `AppDatabase`                       |
| Loaded model facades and selection           | `WorkspaceStore`                                                                  |
| Derived model information                    | `WorkspaceQueriesService`                                                         |
| Model mutation and persistence boundary      | `WorkspaceActionsService`                                                         |
| Successful-command snapshots and restoration | `ModelHistoryService`                                                             |
| Command permissions and active decision      | `InteractionStateService`                                                         |
| Timed status / persistent action slot        | `NotificationService` / `ActionFeedbackService`                                   |
| Validation review / paused removal           | `ModelValidationFeedbackService` / `RunningActionService`, `RemovalReviewService` |
| Graph mode and contextual hint               | `GraphToolsService`                                                               |
| Routes, dialogs and shortcut bindings        | `NavigationService`, `DialogService`, `ShortcutService`                           |
| Property workspace and internal history      | `PropertyEditingService`, `PropertyEditorComponent`                               |
| Canvas, geometry and viewport                | `GraphComponent`, `GraphRenderer`, graph helpers, `GraphViewport`                 |
| Shared panel and overflow UI                 | `EditorPanelComponent`, `ScrollOverflowDirective`, `ScrollHintsComponent`         |

Keep `view`, `services`, `states`, `models`, `directives`, `guards` and `utils` separate. Screens compose views; components own their local interface; services own workflows. State-independent calculations belong in pure helpers. `WorkspaceService.store/queries/actions` is the component-facing workspace facade.

## Entry and project lifecycle

- `HomeScreen` owns first-navigation intro and JSON file selection. `ProjectEntryScreen` keeps Create/Open cards mounted when revealing the alternative, preserving drafts and search.
- Project components submit through `ProjectService`; `ProjectRepositoryService` owns database transactions and import ordering. Schema changes are versioned migrations in `AppDatabase`.
- `WorkspaceScreen` synchronises project, level and selected node/relation with the route. Leaving it clears the selected project and invalidates project-scoped workflows. Node/level navigation within it retains the workspace.
- Project metadata is stored separately from Core model metadata. Do not propagate a project rename into model identity or URI.

Identity fields are not interchangeable:

| Field               | Meaning                                            |
| ------------------- | -------------------------------------------------- |
| `record.modelId`    | IndexedDB record key                               |
| `record.gmodel.id`  | Core model identity                                |
| `levelIndex`        | Ordered navigation position, not inheritance depth |
| Qualified reference | Declaring model plus element identity              |

## Adding a model command

1. Use an editing service when the command involves a chooser, confirmation or navigation.
2. Implement the mutation in `WorkspaceActionsService`, using the public Core API. Enter `InteractionStateService.mutate()` before touching Core, history or storage; delegate-only entry points and removal previews also check availability.
3. Validate a trial change where the existing action uses `persistValidatedChange`. Do not worsen imported diagnostics. The common mutation wrapper captures history before editing, records only after successful persistence and restores the snapshot on failure. Keep `saveWorkspace()` private.
4. Capture project/model identity before awaiting and verify it before restoring state, selection or UI. Roll back failed validated edits only while that captured context is still current.
5. Translate feedback and verify success, refusal, invalid input, save failure and stale completion.

`WorkspaceStore.getDraft()` returns the cached facade for a level. Reuse it so Core's revision-aware validation/advisor cache remains effective. Trial validation still checks every editable model. Keep structural equality on unchanged graph/colour signals to avoid unnecessary redraws.

## Model history

`ModelHistoryService` replaces the relationship-only history. It stores up to 50 immutable before/after workspace snapshots per project session. Record through the common `WorkspaceActionsService.mutate()` wrapper, not inside individual commands. Batch/cascade operations therefore remain one step. Undo/Redo use the interaction gate directly and never record restoration as a new edit.

`ProjectService.projectSelectionChanges$` clears the timeline and advances its session identity synchronously. Snapshots include all model branches, selected model/element and per-level view preferences. Signature checks reject an unrecorded external change; session checks reject stale completions after project exit/re-entry. No-op/failed commands leave the timeline unchanged.

Restoration persists models before moving either history stack, then navigates by Core model identity rather than obsolete level indexes. `recoveredViews` restores preferences only for recreated records; existing camera/palette preferences remain current. A failed save restores the live model and retains the cursor. Post-commit manifest-refresh errors are reported separately so a committed edit is not falsely rolled back. The history is not persisted or exported.

## Feedback and interaction

- `NotificationService.show()` accepts status content only and manages replacement, timeout and hover/focus pause. `NotificationsComponent` renders that slot.
- `ActionFeedbackService.publish()` updates one registration per typed feature owner. Removal review has priority over model validation. `release(id)` ends a registration; `run()` prevents duplicate button execution but grants no editing permission. There is no action timer or per-feature button-style override.
- `ActionFeedbackComponent` is the only action renderer. Mount it and the status outlet in either the main editor or node editor, never both views simultaneously. `FeedbackComponent` owns presentation, not workflow state.
- `InteractionStateService` owns `ready`, `decision` and `executing`, including identity, project, revision and abort signal. Stale handles cannot release or restore a newer interaction. `BlockingActionOwner` excludes validation review.
- `RunningActionService.start()` captures the revision and registers a decision. Resume enters execution before checking the revision and invokes the restoration callback with its abort signal. Completion releases it; failure restores the decision. `RemovalReviewService` stores route, consequence selection and scroll position. The callback must honour cancellation before restoring UI.
- An `InteractionBlockedError` from an action-owned conflict updates that action's attention signal. `ProjectService.reportError()` does not turn it into a second status. Native forms may show the instruction locally. `PropertyEditorComponent.runPendingAction()` currently re-emits dialog errors as plain statuses; that path can repeat a refusal message and needs a dedicated follow-up if changed.
- Validation review is owned by a root service, not toolbar lifetime. Its signature includes project, model and diagnostics; closing suppresses the unchanged signature. It survives inspector/property/dialog transitions but ends on resolution or context loss.

The user-visible lifecycle and cancellation rules are defined in [Feedback and pending decisions](features.md#feedback-and-pending-decisions); keep changes consistent with that contract.

## Property workspace and resumable workflows

The node workspace stays inside `WorkspaceScreen`; the main graph remains mounted, hidden and inert. `PropertyEditingService` owns the selected node/property, section and internal Back/Forward history. `PropertyEditorComponent` coordinates navigation and draft guards. The neighbourhood graph reuses `GraphRenderer`/`GraphViewport`; its pan/zoom never overwrites the main viewport.

| Editing path                            | Owner and save boundary                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| Inline property name/type/multiple mode | `PropertyListComponent`; name on Enter/blur, confirmed control changes immediately   |
| Blank property row                      | `PropertyListComponent`; submit or leave the row's name field; empty creates nothing |
| Reordering                              | Sushi OrderList plus `reorderAttributes`; persist actual property IDs/order          |
| Advanced property details               | `PropertyDetailsDialog` + `PropertyFormComponent`; explicit Save, local form draft   |
| Shape settings                          | `ShapeEditorComponent`; explicit Save                                                |
| Shape-owned property/relation detail    | `PropertyFormComponent.shapeId` / `ShapeRelationFormComponent`; separate Save        |

Inline writes use one sequential queue. Keep row IDs, focus and scroll stable; wait for saves before details, duplication or removal. Do not globally disable/recreate the list for a brief write. The paint yield before synchronous Core validation has a hidden-window fallback; it is not a replacement animation.

Guard departure according to the actual draft owner. Inline invalid names stay focused rather than opening a fictitious global Save workflow. Property detail dialogs own their Save/Cancel. Shape navigation resolves detail/settings drafts with scoped Save/Discard/Cancel; invalid drafts remain visible. Never replay a blocked edit automatically after resolving a prepared action.

`NodeContextPanelComponent` opens the shared name/description dialog. `_property-panels.scss` owns shared list/window structure. Read-only inherited details retain declaration identity so navigation can reopen the exact source property.

`AnnotationVocabulariesComponent` supplies preset selection through a Popover. Presets live in `annotation-vocabularies.ts`; adding a batch skips existing types. Shape rules resolve existing model relationships, not new edges. `features.ts` enables the editor in standard builds; `features.signed.ts` disables it in signed distributions while retaining model data.

## Graph and shared UI

- `WorkspaceScreen` owns panel placement and occupied canvas space. `EditorPanelComponent` supplies a shared frame; put the scrolling element and its shared hints in one `nori-scroll-frame` cell.
- Base Nodes and Refinements have different data/actions. Share visual primitives instead of combining them into a large mode-dependent component.
- SVG drawing belongs in `GraphRenderer`; geometry/layout in helpers; pan/zoom/fit in `GraphViewport`. ELK calculations run in a worker that terminates with the graph.
- Route selections through `NavigationService`; node and relation selections clear each other. Preserve the viewport when opening the node workspace.
- `GraphImageExport` captures SVG/PNG independently of viewport and panels. `ExportService` owns the file picker/download fallback; keep rasterisation separate from file-dialog logic.
- Ordinary dialogs use `DialogService` and its pending/error state. Confirmation details retain their measured opening sequence. Operation success closes the dialog; failure keeps its local feedback available.

## Import and export boundary

`utils/project-import.ts` validates the published Core transport schema and reconstructs declarations by owner without requiring semantic validity. It rejects unsafe structure/ownership before persistence. It neither substitutes dependencies nor changes Core's strict `RamenModel.import()`.

`WorkspaceStore` restores editable facades through `RamenModel.load()` and exposes their diagnostics. Export remains strict and checks that every stored branch is included before writing. See the [functional import contract](features.md#importing-and-exporting-models) and [fixtures](../examples/import-models/README.md).

## Extending shortcuts and languages

For a shortcut, extend `ShortcutAction`/`SHORTCUT_DEFINITIONS`, bind execution in the toolbar and reuse the command's normal guards. Add labels for every language and use `ShortcutService.display/aria`; never repeat default bindings in templates. Check remapping, conflicts, focus, dialogs and text editing. [Keyboard shortcut review](keyboard-shortcuts.md) defines the defaults.

For a language, register it in `i18n/languages.ts`, add its JSON and all language-option labels. Update every registered language for new product strings, including singular/plural counts. Check dynamic translation keys before deleting entries.

## Assets, runtime and verification

- Preserve `editor/public/images/nori-logo-clean.svg` for small marks and `nori-logo-worn.svg` for large/native assets. `LogoIntroComponent` owns the supplied video; `BrandIllustrationComponent` owns home artwork/motion.
- `icons/icon.icon` owns native macOS appearance variants. Do not replace packaged dock icons programmatically. Packaging and signing are documented in [Build and distribution](deployment.md).
- The desktop stays hidden until the first rendered route sends validated readiness IPC. `DesktopLocationStrategy` retains the absolute `index.html` entry for reload; browser routing stays separate.
- RAMEN Core comes from npm/lockfile; no sibling checkout/build is needed. Keep route-level imports lazy and respect bundle/style budgets.
- Run `npm run verify` for lint, formatting, types and both builds. Run `npm run test:feedback`, `npm run test:history` and `npm run test:import` separately for interaction/command, history and exchange regression checks. These are service-level checks, not an automated browser suite.
- Verify changed workflows with the keyboard, real drafts, persistence failures, navigation, reduced motion and the relevant desktop/browser surface. A successful build does not establish those behaviours.
