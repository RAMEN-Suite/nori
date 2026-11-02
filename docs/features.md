# Features and behaviour

This is the functional contract for Nori. [UI guidelines](ui-guidelines.md) define presentation; the [Editor guide](editor-components.md) maps features to their implementation.

## What Nori edits

Nori edits RAMEN model definitions, not the individual records of an edition. A node named Person defines a type; it is not a person record. Properties and constraints describe the data that records may contain.

| Concept          | Meaning                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------- |
| Project          | A locally stored workspace containing model levels and project metadata                       |
| Model level      | A versioned model with its own name, URI, description and exact imports                       |
| Base node        | An available type declared in another model; using it does not copy or change its declaration |
| Refinement       | A locally declared type based on an available type                                            |
| Property         | A typed field with value-count and behaviour rules                                            |
| Annotation shape | A named annotation type with its own properties and selected relationship rules               |
| Constraint       | A rule restricting a definition or its eventual data values                                   |

Project name/description are separate from model-level metadata. Definition descriptions document models, nodes, properties and annotation shapes; they are not record data.

## Start screen

- Create opens project creation; Open lists saved projects; Import reads a RAMEN JSON file. Settings and the RAMEN resource links are available before opening a project.
- The logo intro runs only on the initial home navigation when motion is enabled. Returning from the editor skips it. Reduced motion, disabled animations or playback failure reveal the usable screen.
- An import blocks duplicate submissions. Cancelling the file picker changes nothing; invalid input leaves the start screen open with an error.

## Creating and opening projects

Create and Open are two views of the same entry screen. Revealing the alternative keeps existing form input and search state. While an operation is pending, the other card and navigation cannot start a competing operation.

### Create

- Supply a project name of 3–70 characters and an optional description of up to 2,000 Unicode code points. The submitted name and description are trimmed.
- An empty project starts with an editable RAMEN model and its reference model. The optional correspondence example adds Letter, Text, Person and Place types with example relationships.
- Enter submits a valid form. Creation opens the project only after local persistence succeeds; failure retains the form.

### Open

- Saved projects are ordered by most recent update. Search matches project names and descriptions without case sensitivity.
- Each entry opens the project, duplicates it, or requests removal. Duplication creates an independent local project; it does not overwrite or open the source.
- Removal requires confirmation and deletes the project's local model records. There is no project trash or general project-deletion undo.
- Loading, an empty project collection, no search matches and a failed operation are distinct states.

### Local persistence

Projects and graph preferences live in IndexedDB; application preferences and shortcuts use local storage. Storage belongs to the current browser origin or desktop profile. Opening a project does not create a live connection to a JSON file. Export is the portable copy; clearing local application data can remove saved projects.

## Importing and exporting models

Import reconstructs all supplied model declarations under their original owners. It retains annotation shapes and project metadata and never fills a missing dependency with a different model.

| Input                                                                                                                       | Behaviour                                                                  |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Valid RAMEN file                                                                                                            | Opens normally                                                             |
| Structurally readable model with semantic errors                                                                            | Opens with findings so available definitions can be inspected and repaired |
| Missing dependency                                                                                                          | Opens with a finding; dependency recovery is not implemented               |
| Malformed/unsupported format, unknown declaration owner, duplicate model identity, missing/non-RAMEN root or cyclic imports | Rejected before persistence                                                |

The validation review shows a headline and finding count. Technical messages and reference IDs belong in its findings dialog. Invalid projects still offer primitive property types for repairing broken datatype references; graph and inheritance suggestions may be unavailable until validation succeeds.

JSON export requires a valid project. It preserves declarations, inheritance, annotations and project metadata, not Nori's panel state or application preferences. If Core cannot include every model branch, Nori rejects export instead of writing a partial project. The strict Core import/export APIs remain unchanged by Nori's repair import. See [import examples](../examples/import-models/README.md).

## Main editor

The project title opens its metadata dialog. Saving changes the project name/description, not the model names or URIs. Back returns to Start. Empty editable graphs offer available base types as starting points for refinements.

### Model levels and inheritance

Selecting a level changes the model being inspected and edited. The list's numeric positions are navigation indexes, not inheritance depth. The packaged RAMEN reference model is read-only.

A new level derives from the current editable level. While viewing a reference model, Nori uses the editable workspace model as the creation parent. Its name, absolute URI, semantic version and optional description identify it independently of the project. Level names can also be renamed inline. Updating model metadata also updates matching import headers. Removing a level previews affected dependent levels, nodes and relationships before confirmation.

Base Nodes lists available imported types. Refinements lists local types by their base, with search and collapsible groups. Refinements are alphabetically ordered within their groups. Inherited definitions are inspected at their source rather than silently copied into the current model.

Refine creates a local type based on the chosen definition. Duplicate creates another local type with copied own properties, constraints and incident local relationships. Node removal previews dependent refinements and relationships; confirmation also removes the node’s own properties and constraints.

### Graph tools

| Tool    | Behaviour                                                                              |
| ------- | -------------------------------------------------------------------------------------- |
| Select  | Selects a node or relationship for the inspector; either selection clears the other    |
| Connect | Uses source then target selection or a drag; double-click requests a self-relationship |
| Erase   | Requests a removal preview; clicking does not immediately delete                       |

Core determines permitted relationships. A compatible relationship is created directly when unambiguous; multiple choices open a chooser. Invalid directions and duplicate relationships report a status instead of creating an edge. Escape leaves the tool mode. Undo/Redo currently covers relationships only.

Pan/zoom changes the viewport. Fit brings the current graph into view without rearranging nodes; Reset layout recalculates positions. Graph positions and viewport are saved as view preferences. Panel visibility changes available canvas space without changing the model.

Imported base types can be shown on the canvas without refinement. Removing one from the canvas retains its source definition; connected local relationships require a removal review. Colours apply to a base-type family and its refinements, save immediately, and support palette shuffle and reset.

SVG/PNG export captures the complete current graph, independently of its zoom, without panels or selection controls. An image is not a model file and cannot replace JSON export.

### Inspector and node details

The inspector shows the selected definition and its properties or relationship endpoints. Double-click can rename an editable node inline; Enter saves and Escape cancels. Node names are normalised through Nori's naming helper and limited to 40 characters. Name and description can also be edited together in the node-details dialog. Imported definitions remain read-only in the current model.

Edit node opens a dedicated workspace for Properties, Annotations and Constraints while preserving the main graph view. Its optional neighbourhood graph shows the selected node and directly connected neighbours. Selecting an ancestor or neighbour keeps internal Back/Forward history; closing returns to the main editor.

### Properties

- Own properties edit name, datatype and single/multiple-value mode inline. Names save on Enter or blur; a confirmed datatype or multiple-value choice saves immediately. Escape cancels the name draft. Invalid drafts remain local with field feedback.
- The blank row creates a property on Enter or when its name field loses focus outside the row. Moving between that row's controls does not create prematurely. Empty names create nothing; Escape clears the row. Success resets it to String/single value.
- Drag handles, the movement menu and keyboard movement reorder actual model properties. Duplication chooses a free name and clears the identifier flag. New/renamed property names are limited to 40 characters; imported names are preserved.
- Inherited properties share one collapsible section and are read-only. View opens details; Go to source opens the declaring node/property and preserves a return path. Collapsing either section retains its drafts.
- The details dialog edits descriptions, cardinality and behaviour flags. These edits require Save; Cancel discards that dialog draft. Save failure keeps the dialog available for correction or retry. This is separate from inline automatic saving.

| Rule                  | Meaning                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| Optional / Required   | Zero or one value / exactly one value                                                                |
| List / Non-empty      | Any number of values / at least one value                                                            |
| Custom bounds         | Explicit minimum and maximum; an empty maximum is unlimited                                          |
| Preserve value order  | Value positions are meaningful                                                                       |
| Allow repeated values | The same value may occur more than once                                                              |
| Read-only values      | Values are intended to remain unchanged after being set                                              |
| Identifier            | One required, single identifying value; a competing inherited/local key makes the option unavailable |

Inline saves are serialised and retain focus and scroll position. Details, duplication and removal wait for pending row saves. Accepted commands persist automatically; opening another row is not a second Save mechanism. Failed validated edits restore the previous model while retaining a correctable draft.

### Annotations and vocabularies

Annotation editing is available for Annotation nodes/refinements when the build enables it. Standard browser/local builds enable it; signed distribution builds currently disable the editor without removing imported annotations.

- Opening the area does not create a draft. Its alphabetically sorted list includes local and inherited shapes. Search opens an exact match or creates a new type when submitted; an empty submission opens the creation form.
- Shared node properties apply across its annotation types. Shape-owned properties belong only to that type. Inherited shapes and shared properties are read-only from the shape editor.
- Vocabularies add selected types or a complete preset, skip existing names and persist the batch together. The text-editor preset defines `p`, `head`, `lb`, `row`, `cell`, `list`, `item`; `head.level` and `cell.cols/rows` are optional Integer properties.
- The TEI preset contains `date`, `persName`, `placeName` as starter names. It does not import TEI P5 attributes, XML content rules or the complete guidelines. Nori does not provide a text-record editor through this preset.
- Shape settings, properties and relationship rules have separate drafts and Save actions. Leaving a detail resolves that draft; leaving the shape resolves both detail and settings drafts through Save/Discard/Cancel. Invalid drafts stay visible. Rules select existing relationships and their combined cardinality; they do not create graph edges.

### Constraints and descriptions

The Constraints area opens property rules in the details dialog and displays node constraints, including inherited rules. A general editor for custom constraint expressions is not implemented. Imported rules are retained.

Definition descriptions use the shared 2,000-code-point limit and visible counter. Project descriptions use the same UI limit but remain project metadata. A description is optional; saving an empty description removes its content rather than inventing placeholder text.

## Feedback and pending decisions

| Element | Purpose                           | Lifetime                                                                              |
| ------- | --------------------------------- | ------------------------------------------------------------------------------------- |
| Status  | Reports an operation's outcome    | Six seconds, paused by hover/focus, or Close; no task button                          |
| Action  | Offers a still relevant next step | No timeout; ends through completion, cancellation, resolution or context invalidation |
| Hint    | Explains the active graph tool    | Exists only for that mode/context; no controls                                        |

Statuses and actions have independent state. New statuses replace the current status in place and never remove an action. One action is visible: a paused removal takes priority over validation review without discarding it. Hints yield to the occupied action slot. Opening a dialog does not dismiss background feedback.

Validation review is non-blocking. View findings opens inspection and does not finish the review. Resolving findings removes it; Close suppresses that unchanged finding set. Changed findings or a new model/project context may offer it again.

A removal confirmation lists consequences. Inspecting an affected entry pauses the decision and opens the graph; Resume restores the confirmation and its detail selection. Inspection never confirms deletion. Cancel ends the prepared workflow.

| Interaction state | Allowed behaviour                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| Ready             | A model command may start                                                                                 |
| Decision pending  | Navigation and inspection remain possible; competing model commands are rejected before changing anything |
| Executing         | Competing commands and double Resume are rejected until the operation/persistence finishes                |

A rejected edit keeps the prepared action, gives it a brief attention cue and explains Resume/Cancel. With motion disabled only the explanation changes. Resume rechecks the captured revision; unexpected external changes invalidate an unsafe preview. Project exit/change aborts the workflow. Failed Resume returns to the pending decision for retry. These checks apply equally to buttons, shortcuts, inline editing and drag-and-drop.

## Settings and keyboard behaviour

Settings is available on Start, project entry and the editor. Language (English, German, Italian or system), theme (light, dark or system), animation preferences and shortcut assignments save immediately. System language falls back to English when unsupported. Help & Support links to support, RAMEN resources and credits.

Shortcut capture reports invalid/conflicting assignments; Escape cancels capture, Tab keeps normal navigation, and Reset restores defaults. Global editor shortcuts do not override text entry, focused widgets, dialogs or the node workspace. See [bindings and compatibility](keyboard-shortcuts.md).

## Current boundaries

There is no record-data editor, dependency-recovery UI, arbitrary constraint-expression editor, project trash, general edit undo or complete TEI P5 import. Signed builds hide annotation editing. Branching model export may be rejected until Core can represent the complete workspace. Do not describe these as available features.
