# Architecture and component map

Nori has an Angular editor in `editor/` and an Electron host in `electron/`. The editor owns modelling and local project storage. Electron owns native windows, menus and file access. RAMEN Core owns schema and model semantics. Sushi supplies UI primitives.

## Editor views

Paths below start at `editor/src/app/view/`.

| Location                                                           | Responsibility                                                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `screens/home/`                                                    | Home, first-visit intro and model import entry                                                                                         |
| `screens/project-entry/`, `components/projects/`                   | Create/open workflows, search, project forms and entry artwork                                                                         |
| `screens/workspace/`                                               | Compose the main editor and node editor, coordinate route selection and panel visibility                                               |
| `components/workspace/tool-bar/`                                   | Graph tools, panel controls, command shortcuts and export                                                                              |
| `components/workspace/catalogue/`, `model-levels/` under workspace | Browse base nodes and refinements, manage model levels                                                                                 |
| `components/workspace/graph-view/`                                 | Main canvas, node/relation actions and graph hints. Its `graph/` directory owns rendering, geometry, layout, viewport and image export |
| `components/workspace/inspector/`                                  | Selected node or relation, descriptions and property summaries                                                                         |
| `components/workspace/property-editor/`                            | Node editing surface, node context and neighbourhood, property rows and forms, annotation shapes and presets                           |
| `components/workspace/model-validation/`                           | Entry point for model findings                                                                                                         |
| `components/dialogs/`                                              | Settings, project/model/node edits, property details, colours, diagnostics and confirmations                                           |
| `components/shell/`                                                | Title bar, settings entry, dialog host and feedback outlets                                                                            |
| `components/shared/`                                               | Reusable panel, description field, feedback surface and scroll hints                                                                   |

Keep related templates and styles beside the component. Shared styles live in `editor/src/styles/`, translations in `editor/src/app/i18n/` and runtime feature flags in `editor/src/environments/`.

## State and service boundaries

- `ProjectService` coordinates project selection and persistence. `ProjectRepositoryService` and `AppDatabase` own IndexedDB transactions and migrations. Project metadata is separate from model metadata.
- `WorkspaceService` exposes the store, queries and commands. `WorkspaceStore` owns loaded Core facades and selection. `WorkspaceQueriesService` derives model information. `WorkspaceActionsService` owns edits and persistence.
- Workspace editing services coordinate navigation, tools and confirmations. `PropertyEditingService` owns the active node editing session. The neighbourhood and main graph share rendering primitives and keep their own viewport state.
- `InteractionStateService` guards model mutations while a decision or operation is pending. `ModelHistoryService` records successful commands and restores snapshots. Keep validation, rollback and history inside the shared command path.
- `NotificationService` manages transient statuses. `ActionFeedbackService` manages persistent actions. `DialogService` owns dialog state and `DialogHostComponent` renders it.
- `utils/project-import.ts` validates the file structure and declaration ownership before a project is saved. Semantic findings remain available in the editor. Desktop IPC stays behind the preload and validated handlers.

## Put a change in the right layer

For a new command, connect the UI to an existing editing service where it needs a chooser, confirmation or navigation. Implement the mutation through `WorkspaceActionsService` and reuse its interaction and history boundaries. For a new view, compose shared UI in the owning feature directory and use queries for derived data. For a new shortcut, update the definitions in `utils/shortcuts/`, route it through the same command and translate its labels in every supported language.

See the [contribution guide](../CONTRIBUTING.md) and [coding conventions](coding-conventions.md).
