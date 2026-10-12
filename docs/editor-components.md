# Editor components and extension guide

## Where behaviour belongs

| Area                                      | Owner                                            | Responsibility                                                                          |
| ----------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Panel placement and available graph space | `WorkspaceScreen`                                | Open state, column heights and canvas padding.                                          |
| Panel frame                               | `EditorPanelComponent`                           | Shared heading, icon slot, close action, animation and hidden-state accessibility.      |
| Refinement catalogue                      | `SideMenuComponent`                              | Categories, selection, inline naming, keyboard order and revealing newly created nodes. |
| Base-node catalogue                       | `BaseNodesComponent`                             | Ancestor groups and adding/removing references on the current canvas.                   |
| Model levels                              | `ModelLevelsComponent`                           | Level selection, naming and creation/removal.                                           |
| Inspector                                 | `NodeViewComponent` and its attribute components | Selected node information and access to property/annotation editing.                    |
| Graph                                     | `GraphComponent`                                 | Coordinate rendering, interactions, viewport and persistence.                           |
| Graph drawing                             | `GraphRenderer`                                  | SVG nodes, edges, labels and highlighting.                                              |
| Graph layout                              | `graph.layout.ts` and `GraphAutoLayout`          | Geometry, placement, fit calculation and automatic layout.                              |
| Settings                                  | `SettingsDialog`                                 | Appearance and shortcut editing through the corresponding services.                     |
| Modal lifecycle                           | `DialogService` and `DialogHostComponent`        | Opening/closing, sizing, focus, errors and pending state.                               |

Components use `WorkspaceService.store` for state, `.view` for derived information and `.actions` for changes. Keep persistence and RAMEN rules out of templates and catalogue components. `NodeEditingService` owns shared node actions; `GraphToolsService` owns relationship-tool state.

## Adding a hotkey

1. Add its ID to `ShortcutAction` in `editor/src/app/models/Shortcut.ts`.
2. Add one entry to `EDITOR_SHORTCUTS` with its ID, category, default key and translation key. Use an existing category unless the action really needs another group.
3. Add the operation to the typed `actions` record in `ToolBarComponent`. TypeScript requires an implementation for every action ID. Route changes through existing workspace actions or component outputs.
4. Add the visible action where appropriate. Use `ShortcutService.display(id)` in its tooltip and `.aria(id)` for `aria-keyshortcuts`; never repeat a default key in the template.
5. Add any new labels to both `i18n/en.json` and `i18n/de.json`. The Settings rows are generated from the definitions, so they need no manual entry.
6. Check default execution, reassignment, duplicate rejection, reload persistence and reset. Shortcuts must not execute while a dialog or text control is active.

Bindings use lowercase keys joined with `+`, for example `shift+r` or `mod+z`. `mod` means Control on Windows/Linux and Command on macOS. Escape and Tab are reserved for cancelling capture and navigating. A new category also needs an entry in `SHORTCUT_CATEGORIES`, translations and a heading icon in Settings.

`ShortcutService` owns binding resolution, labels, conflicts and local persistence. Settings owns capture feedback. The toolbar owns execution; it must keep the same editability/pending guards as the corresponding button.

## Adding a panel or dialog

- Build panels with `EditorPanelComponent`, place them in `WorkspaceScreen`, and include their occupied space in canvas padding. Keep animation and column resizing in the screen/frame rather than the panel contents.
- Open dialogs through `DialogService.open`. Use the compact size for confirmations and short choices; use the default form size for editing. Use the shared scroll-content and action-footer classes.
- Use public Sushi tokens and APIs. The catalogue uses an inset focus offset because Sushi clips outward accordion outlines. Keep focus visible on headers, list rows and action buttons.
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

`SideMenuComponent.groupLocalNodes` can become a pure grouping function if more filtering or category rules are added. This separates model grouping from DOM focus/reveal behaviour and gives the grouping rules a clear test boundary.

Keep Base Nodes and Refinements as separate components: their source data and actions differ. Share visual tokens and list styles, not a large generic component with many conditional modes. Keep the existing category-plus tab order explicit until Sushi supports a sibling action slot with the required keyboard order.

### Keep the existing boundaries

`EditorPanelComponent`, the dialog host, the workspace store/view/actions split, `NodeEditingService` and the shared list styles already provide useful reuse. The small form dialogs do not need further splitting. New helper classes should own one coherent behaviour and have a clear caller, rather than simply reducing file length.

## Verification

Run `npm run lint`, `npm run format`, `npm run typecheck` and `npx ngc -p editor/tsconfig.app.json --noEmit`. For UI changes, also check keyboard navigation and focus at the edges of scrolling content. For graph changes, check saved viewport restoration and fit with panels both open and closed.
