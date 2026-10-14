# Editor components and extension guide

The UI keeps separate component folders under `view/components`, grouped by purpose where useful; see [Folder responsibilities](code-conventions.md#folder-responsibilities). Full application views live in `view/screens`.

## Where behaviour belongs

| Area                                      | Owner                                                                        | Responsibility                                                                                                                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel placement and available graph space | `WorkspaceScreen`                                                            | Open state, column heights and canvas padding.                                                                                                                        |
| Panel frame                               | `EditorPanelComponent`                                                       | Shared heading, icon slot, close action, animation and hidden-state accessibility.                                                                                    |
| Scroll indicators                         | `ScrollOverflowDirective` and `ScrollHintsComponent`                         | Measure overflow and remaining scroll directions; render non-interactive hints in the same grid cell as the scroll area, using the shared `nori-scroll-frame` layout. |
| Refinement catalogue                      | `RefinementsComponent`                                                       | Categories, selection, inline naming, keyboard order and revealing newly created nodes.                                                                               |
| Base-node catalogue                       | `BaseNodesComponent`                                                         | Ancestor groups and adding/removing references on the current canvas.                                                                                                 |
| Model levels                              | `ModelLevelsComponent`                                                       | Level selection, naming and creation/removal.                                                                                                                         |
| Property editing                          | `PropertyEditingService`, `PropertyEditorComponent`, `PropertyFormComponent` | Shared dialog editor with expandable property cards, conditional options, unsaved-change handling and inline validation; closes on navigation.                        |
| Inspector                                 | `NodeViewComponent` and its attribute components                             | Selected node information and access to property/annotation editing.                                                                                                  |
| Graph                                     | `GraphComponent`                                                             | Coordinate rendering, interactions, viewport and persistence.                                                                                                         |
| Graph drawing                             | `GraphRenderer`                                                              | SVG nodes, edges, labels and highlighting.                                                                                                                            |
| Graph layout                              | `graph.layout.ts` and `GraphAutoLayout`                                      | Geometry, placement, fit calculation and automatic layout.                                                                                                            |
| Settings                                  | `SettingsDialog`                                                             | Appearance and shortcut editing through the corresponding services.                                                                                                   |
| Modal lifecycle                           | `DialogService` and `DialogHostComponent`                                    | Opening/closing, sizing, focus, errors and pending state.                                                                                                             |

Components use `WorkspaceService.store` for state, `.queries` for derived information and `.actions` for changes. Keep persistence and RAMEN rules out of templates and catalogue components. `NodeEditingService` owns shared node actions; `GraphToolsService` owns selection, connection and eraser modes. The graph routes eraser clicks on local nodes to `NodeEditingService.confirmRemoval`, on base nodes to `.confirmCanvasRemoval`, and on edges to `GraphToolsService.remove`. All three use the existing affected-element previews.

## Adding a hotkey

1. Add its definition to `EDITOR_SHORTCUTS` in `editor/src/app/utils/shortcuts.ts`; `ShortcutAction` is derived from these entries.
2. Give the entry its ID, category, default key and translation key. Use an existing category unless the action really needs another group.
3. Add the operation to the typed `actions` record in `ToolBarComponent`. TypeScript requires an implementation for every action ID. Route changes through existing workspace actions or component outputs.
4. Add the visible action where appropriate. Use `ShortcutService.display(id)` in its tooltip and `.aria(id)` for `aria-keyshortcuts`; never repeat a default key in the template.
5. Add any new labels to every registered translation file under `i18n`. The Settings rows are generated from the definitions, so they need no manual entry.
6. Check default execution, reassignment, duplicate rejection, reload persistence and reset. Shortcuts must not execute while a dialog or text control is active.

Bindings use lowercase keys joined with `+`, for example `shift+r` or `mod+z`. `mod` means Control on Windows/Linux and Command on macOS. Escape and Tab are reserved for cancelling capture and navigating. A new category also needs an entry in `SHORTCUT_CATEGORIES`, translations and a heading icon in Settings.

`ShortcutService` owns binding resolution, labels, conflicts and local persistence. Settings owns capture feedback. The toolbar owns execution; it must keep the same editability/pending guards as the corresponding button.

## Adding a panel or dialog

- Build panels with `EditorPanelComponent`, place them in `WorkspaceScreen`, and include their occupied space in canvas padding. Keep animation and column resizing in the screen/frame rather than the panel contents.
- Open dialogs through `DialogService.open`. Use the compact size for confirmations and short choices; use the default form size for editing. Use the shared scroll-content and action-footer classes.
- Use `TooltipDirective` with `noriTooltip` for Sushi tooltips. It suppresses the single automatic focus return after a dialog closes; normal hover and keyboard focus retain Sushi’s behaviour.
- Use public Sushi tokens and APIs. The catalogue uses an inset focus offset because Sushi clips outward accordion outlines. Keep focus visible on headers, list rows and action buttons.
- Place the scrolling element and `ScrollHintsComponent` as direct children of `nori-scroll-frame`. Both share one grid cell, so their edges stay aligned with fractional heights and varying outer padding. Keep borders and frame padding outside this grid; do not add per-dialog hint offsets.
- `ScrollOverflowDirective` observes the scroll container and its rendered direct children. Keep it attached to the actual scrolling element. If a future view replaces those children after initial render, extend its observation lifecycle rather than adding a second overflow detector.

## Component scan: recommended next boundaries

### 1. Graph viewport controller — first priority

`GraphComponent` still combines several responsibilities. Drawing and automatic layout are already separate, but mounting/zooming, transforms, viewport restore/fit and resize observation remain mixed with drag/link interactions.

The next useful extraction is a plain `GraphViewport` class with a small API for mount, restore, fit, transform and destroy. It should report transform changes to the component. Keep workspace persistence in the component or workspace actions; do not make the viewport controller depend on storage. Preserve saved positions, no fit on inspector changes, and disabled double-click zoom.

Avoid moving the entire graph into one large service: that would move the coupling rather than reduce it. A second extraction for pointer/link interaction can follow when that behaviour changes.

### 2. Settings pages — before adding another settings section

The dialog currently has two manageable pages, but both pages share one template, import list and stylesheet. Extract `AppearanceSettingsComponent` and `ShortcutSettingsComponent` when the menu grows. Let the dialog own only Sushi tabs and page placement. Each page should own its content, scrolling and contextual footer; the shortcut page should keep capture state, while `ShortcutService` remains shared.

There is no benefit in separate components for every shortcut row or theme label at this stage. Definitions already generate those repeated elements.

### 3. Catalogue grouping — a smaller, independent extraction

`RefinementsComponent.groupLocalNodes` can become a pure grouping function if more filtering or category rules are added. This separates model grouping from DOM focus/reveal behaviour and gives the grouping rules a clear test boundary.

Keep Base Nodes and Refinements as separate components: their source data and actions differ. Share visual tokens and list styles, not a large generic component with many conditional modes. Keep the existing category-plus tab order explicit until Sushi supports a sibling action slot with the required keyboard order.

### Keep the existing boundaries

`EditorPanelComponent`, the dialog host, the workspace store/view/actions split, `NodeEditingService` and the shared list styles already provide useful reuse. The small form dialogs do not need further splitting. New helper classes should own one coherent behaviour and have a clear caller, rather than simply reducing file length.

## Verification

Run `npm run lint`, `npm run format`, `npm run typecheck` and `npx ngc -p editor/tsconfig.app.json --noEmit`. For UI changes, also check keyboard navigation and focus at the edges of scrolling content. For graph changes, check saved viewport restoration and fit with panels both open and closed.

## Review checkpoint (2026-10-13)

Reviewed the view components against the shared conventions: presentation versus model actions, typed inputs/outputs, lifecycle cleanup, focus/keyboard behaviour, repeated UI patterns and extension points.

- Kept small presentational components together; they do not benefit from per-row services or extra wrapper components.
- Normalised imports and removed duplicate dependencies. Workspace navigation now has one subscription for selection synchronisation and editor cleanup.
- Confirmation summaries resolve nodes and relationships from all project models, with separate compact scroll areas. Their presentation is independent of removal actions.
- Property validation runs on a Core snapshot before changes reach the live workspace. The form preserves existing constraints and validates inherited names and keys.
- The graph viewport remains the next meaningful extraction if graph interactions change. Its existing renderer, geometry and automatic layout boundaries are preserved.
- The current property dialog is the baseline for the next node-editor experiment; replace its presentation without duplicating schema rules or persistence.

## Shared dialog list spacing

Use `styles/_surface-list.scss` for bordered action lists and comparable setting rows. `frame` defines the outer border and inset, `inset` spaces the Sushi List, `row` defines content padding and minimum height, and `action` adds soft neutral hover and expanded states. Colors and removal consequences use the same Sushi List size and these shared mixins.

`RunningActionService` owns one resumable action, its project and a model-revision snapshot. `StorageService.modelChanges$` invalidates actions for changed projects; view preferences are excluded. Resume checks persisted revisions again. `RunningActionNotificationComponent` renders the task icon and Resume/Cancel controls. `RemovalReviewService` supplies the deletion-specific dialog snapshot and restoration callback. Confirmation content restores its selected list and scroll position through `reviewPosition`; graph components stay independent of this flow.

To add a resumable workflow, extend `RunningActionOptions.kind`, add the corresponding notification icon and translated title/hint, then call `start` with its project ID and an async `resume` callback. Honor the callback's abort signal before opening restored UI. Starting another action replaces the previous one. Model writes must use StorageService so invalidation remains consistent.

`RelationViewComponent` renders the selected relation in the Inspector: endpoints, cardinalities and constraints. The workspace stores node and relation selection separately and clears the other kind on selection. Relations use `/ws/:projectId/:slotId/relation/:relationId`; use `NavigationService.navigateToRelation` rather than writing selection signals from graph components. Graph hit paths support mouse and keyboard selection in Select mode, while Erase keeps its removal behaviour.
