# UI guidelines

Shared rules for Nori panels, dialogs and lists. Use public Sushi APIs and tokens; implementation ownership is described in the [Editor guide](editor-components.md).

## Shared components and accessibility

- Use semantic buttons, links, headings, groups and lists. Icon-only controls need accessible names; decorative icons are hidden from assistive technology. Avoid nested buttons and hover-only actions.
- Reuse panel/dialog frames, typography, list spacing and tooltips. Comparable bordered lists use `styles/_surface-list.scss` mixins with Sushi List; keep dimensions in shared styles rather than repeating numbers here.
- Route relevant transient feedback through the shared status notification service and outlet (see below). Field validation stays beside the input.
- Keep focus visible without clipping it. Support keyboard navigation, long/translatable text, small viewports and zoom.
- The node editing screen uses the same shared keyframes and tokens as ordinary dialogs: a subtle scale from 98% over 400ms, becoming opaque early, and a 100ms exit. Panels, content and footer do not animate separately inside it; graph nodes use the same appearance animation as the main graph. The main workspace retains its original panel motion.
- Keep headings and bottom actions fixed; scroll the content area. Use shared scroll hints only when content overflows, with room for the scrollbar and focus rings.
- Respect reduced motion and the user's animation preference. Keep shared motion in its owner; dialog windows enter as one surface using shared motion tokens: a subtle scale from 98% over 400ms without overshoot, becoming opaque early, and a 100ms exit. Start window movement after initial positioning; do not animate dialog contents separately.

## Generic feedback

Use `nori-feedback` for presentation only: frame, typography, padding, circular icon background and semantic severity (`error`, `warning`, `info`, `success`). Purpose and severity are separate. A red action is still an action; it does not move into the status slot.

| Element | Purpose                                                | General editor position                  | Controls                         | Lifetime and owner                                                                                                   |
| ------- | ------------------------------------------------------ | ---------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Status  | Reports the outcome of an operation                    | Top centre below the toolbar             | Close only                       | `NotificationService`: six seconds, paused by hover/focus, or explicit dismissal                                     |
| Action  | Offers an explicit next step for a still relevant task | Bottom centre                            | Specific action and Close/Cancel | `ActionFeedbackService`: no timer; the owning feature releases it when completed, cancelled, resolved or invalidated |
| Hint    | Explains the currently active tool/context             | Contextual, near the bottom of the graph | None                             | `GraphToolsService` owns the mode/source; guidance disappears when the mode/context ends                             |

### Service and lifecycle rules

- `NotificationService.show({ status, message, title? })` accepts no action button. It replaces the current status in place and restarts the six-second timer. Old IDs cannot dismiss newer statuses. Native dialogs leave the status mounted behind their backdrop; opening a dialog is not a dismissal condition.
- `ActionFeedbackService.publish()` registers an action by feature owner and returns its ID. Updating the same owner changes the existing action in place. `release(id)` is an explicit completion/invalidation. There is no duration option, timeout, or automatic completion on button click. The owner supplies both the operation and cancellation callback. Execution is guarded against double submission; controls are disabled while pending. A failed operation reports a separate status and leaves its action available for retry.
- Status and action state are independent: neither replaces, dismisses or resets the other. The active view mounts exactly one status outlet and one action outlet. Actions never stack. Paused removal review has priority over model validation; it temporarily hides that review without cancelling it. When the workflow ends, any still relevant review becomes visible again. Graph hints yield while the action slot is occupied to avoid overlap.
- `ModelValidationFeedbackService` owns the validation action independently of toolbar/component lifetime. It remains across inspector/property-editor and dialog transitions. View findings opens inspection and does not finish the task. Release conditions: no remaining findings, switching model/project, leaving the workspace, or explicit Close. Closing suppresses that unchanged set of findings; meaningful changes to the findings/context may offer a new review. Updating findings never clears and recreates the action first.
- The validation action shows a clear review heading and the number of findings (singular/plural), never raw diagnostic messages or reference IDs. Details belong in the diagnostics dialog. Its review button uses the same neutral outlined Sushi button as every other action. The shared action renderer owns button variant and severity; feature owners cannot override them. The toolbar uses ShieldAlert in the finding severity without a persistent filled background, and ShieldCheck when there are no findings.
- `RunningActionService` owns paused removal state, the captured project revision and its abort controller. It publishes into the same action service. Release conditions: successful Resume, explicit Cancel, a model revision change/removal in that project, switching projects, or leaving the workspace. Navigation between nodes/model levels of the same project preserves the workflow. Resume checks the revision again; failure leaves the workflow available. Its cancellation/invalidation aborts outstanding restoration work.
- Hints have no timer, close control or action buttons. Tool/source/context changes update or remove them through `GraphToolsService`. Do not add a separate service for every hint or place workflow logic in `nori-feedback`.

### Binding interaction state

`InteractionStateService` is the command authority, separate from the action presentation. States are `ready`, `decision` and `executing`. An active state holds its owner, project, identity, optional captured revision and cancellation signal. `RunningActionService` derives its pending flag from this state; the action renderer never grants permission to edit.

| State       | Model commands                                                                  | Inspection/navigation                                        | Ending condition                                                               |
| ----------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `ready`     | Allowed; the accepted command enters `executing` until its persistence finishes | Allowed                                                      | Start a command or a prepared decision                                         |
| `decision`  | Rejected before mutation, history changes or persistence                        | Allowed within the project, including the property inspector | Resume, Cancel, project exit/change or external invalidation                   |
| `executing` | Competing commands rejected; no double Resume                                   | Read-only inspection remains possible                        | Completion releases the state; a failed Resume returns to `decision` for retry |

- All model mutations pass through `WorkspaceActionsService` and `InteractionStateService.mutate()`. Delegating commands and removal previews check availability at entry. Keep `saveWorkspace()` private: checking only during save is too late because Core may already have changed. View-only zoom, pan, layout and colour preferences do not acquire a model-mutation lock.
- A paused removal registers its decision only after capturing the revision. Resume enters `executing` before the revision lookup, checks that revision again, and restores the confirmation. Successful restoration ends the prepared decision; actual deletion still requires confirmation. An unexpected external model change invalidates the captured preview rather than retaining an unsafe stale operation.
- Blocked commands emit an identity-scoped attention signal. The matching action moves briefly once and replaces its explanation with “Resume or cancel the pending action before editing.” Repeated attempts replay the cue without replacing the window or adding timers. Animation-off/reduced-motion settings leave just the textual explanation. The explanation is announced through the action's live content.
- `InteractionBlockedError` distinguishes refusal from a failed edit. The project error channel does not create a second status for an action-owned conflict; that action already explains the refusal. A conflict inside a native form dialog may retain the same explanation locally. Ordinary pending writes without a related action report that an operation is in progress.
- Action feedback and blocking are independent. Model validation registers no decision and remains non-blocking so users can repair findings. `ActionFeedbackService.pending` prevents repeated button submission only; it is not an editing permission check.
- Cancellation invalidates the state identity and aborts its signal. Old completions, failures and releases cannot restore or clear a newer interaction. Never infer permission from a button's disabled state alone: keyboard, drag-and-drop, inline commands and programmatic callers must reach the same gate.

### Presentation and placement

- Feedback titles and short labels have no trailing period. Complete sentences in status, action and hint descriptions end with a period; do not add punctuation automatically to user-authored model descriptions or raw diagnostics. Project Sushi buttons into `feedbackActions` only for actions; `feedbackDismiss` is the separate close/cancel control. Shared presentation never accepts business logic or chooses its screen coordinates.
- Reuse `styles/_feedback-surface.scss`: no shadow, semantic circular icon tile, semibold `text-sm` title, normal `text-xs` description, 0.125rem text gap, 0.625rem vertical / 1rem horizontal padding, 0.875rem column gap and 1.75rem icon background. Status has a lightly tinted surface/border and semantic title; actions use the common neutral surface. Do not add success messages for routine inline saves.
- The general editor fixes status at the top centre below the toolbar (36rem maximum width, responsive limits, title-bar height plus 4.5rem chrome and a 1.25rem gap). Actions use the bottom centre with `--nori-action-bottom` (3.5rem). The node editor anchors both outlets within its own workspace: status one rem below its header and actions at the shared bottom inset.
- `styles/_feedback-motion.scss` defines entry/exit for both outlets (360ms horizontal unfold, 200ms exit), respecting reduced motion and app animation preferences. Keep each slot's window stable during replacement. Only arrival from empty state and final dismissal animate. Keep position on the window so leaving cannot jump to another slot.
- Native dialogs contain only their own field validation and actual operation failures. General feedback stays behind the dialog. Keep form errors beside the affected fields rather than moving them into a general dialog heading.
- Graph hints reuse the common frame with a subtle info tint and the active tool icon (Spline/Connect, Eraser/Erase). They do not compete with a visible action.

Run `npm run test:feedback` for service checks covering independent lifetimes, action persistence, priority, replacement, pending execution, explicit release/cancel and operation failure.

## Keyboard shortcuts

Keep default assignments and platform conventions documented in the [keyboard shortcut review](keyboard-shortcuts.md). Protect native text editing and focused-widget keys; use the platform's primary modifier consistently in matching, visible labels and `aria-keyshortcuts`. Preserve remapping and saved custom bindings.

## Typography and scale

The fixed type scale is defined once in `editor/src/styles/tailwind.css`. Use Tailwind text utilities in templates and the corresponding `--text-*` tokens in component styles; do not add local font sizes in px/pt, intermediate rem sizes, or viewport-based font-size formulas.

| Role                                                                      | Token / utility | Size     |
| ------------------------------------------------------------------------- | --------------- | -------- |
| Hints, counters, compact data rows, badge text and secondary graph labels | `text-xs`       | 0.75rem  |
| Reading text, field/option labels, help links and form section titles     | `text-sm`       | 0.875rem |
| Editable form text, panel headings and graph node names                   | `text-base`     | 1rem     |
| Secondary headings when needed                                            | `text-lg`       | 1.125rem |
| Inspector/node titles                                                     | `text-xl`       | 1.25rem  |
| Large section headings; light brand wordmark                              | `text-2xl`      | 1.5rem   |
| Project entry titles; compact home headings                               | `text-3xl`      | 1.875rem |
| Wide-screen home headings                                                 | `text-4xl`      | 2.25rem  |

- Use the matching `--text-*--line-height` token or Tailwind utility defaults. Reading and input text use regular weight, labels medium, headings semibold; the brand wordmark retains Roboto Light.
- Native text inputs and textareas in editing forms share `text-base`, including descriptions. Compact search controls, buttons, suggestions and badges retain Sushi's size variants; these use the same scale.
- Keep the existing root scale in `customs.css`: 100% on smaller screens, gradually increasing to a maximum of 118% on large screens. All rem-based type and spacing scale together. Preserve browser zoom and user font preferences; do not scale the app using CSS transforms.
- SVG text also reads the shared tokens; graph geometry remains in scene coordinates. Export copies computed text styles.
- Keyboard focus uses `--sui-focus-ring-width`, `--sui-focus-ring-color` and `--sui-focus-ring-offset`. Derive necessary inset offsets from these tokens. Graph selection, erase feedback and domain highlights remain separate states, not replacements for keyboard focus.

## Panel headings

- All workspace panels, including the node editing screen, follow the main editor's panel heading style. Reuse `styles/_panel-heading.scss` (`layout` and `title`); `frame` supplies the matching inset when the panel has no existing `EditorPanel` content inset.
- Use a semantic `h2`, `text-base` / `--text-base`, semibold weight, and a decorative Lucide icon at `size-4`. Centre the icon and title vertically with the shared 0.625rem gap. Do not make the graph heading smaller or lighter than Properties or other panel headings.
- Keep panel headings fixed above scrolling content. Place optional actions on the right without shifting the title's left edge.
- Property sections use Sushi Accordion with independent expansion and preserved content. Combine every inherited property in one “Inherited properties” section regardless of its source model; retain source identity for read-only details and tooltips. Keep the own-model section separate, including its creation row. Collapsing a section must preserve drafts; validation focus reopens the relevant section. Align category titles with the panel heading inset, indent their contents a little further, and use the public separated-accordion gap token between categories. Inherited property actions are View (Eye) followed by Go to source node (ArrowUpRight).

## Dialogs and forms

- Use short, specific sentence-case titles that describe the task or decision. Plain titles have no decorative icon or forced uppercase. Avoid generic “Warning” and “Are you sure?”.
- Centre ordinary dialogs and respect the viewport. Use shared compact/form sizing; the property workspace is a dedicated editing screen.
- Follow the node-colours dialog's calm style: clear introduction, thin bordered content area and compact actions. Use feedback boxes for feedback, not decorative instructions.
- Keep labels above full-width controls, validation inline and near its context, and enough inset for focus rings. Use `nori-field-label` for field labels (0.875rem, medium) and `nori-field-optional` inline for optional markers. Hints and counters use smaller, regular text. Translate all visible text.
- Definition descriptions use the shared field with 1rem input text, smaller hints/counters, and the Core `DESCRIPTION_MAX_LENGTH` limit, counting Unicode code points. Show the counter and over-limit errors beside the textarea; never truncate pasted or imported text. Project descriptions use the same field and UI limit; Core treats project metadata separately from model definitions.
- Enter in a form input submits through the same guarded save/create action as its footer button. Autocomplete/select controls handle selection first; multiline fields keep Enter for new lines.
- Put actions bottom right: neutral Cancel first, one specific primary action last. Use Sushi button size `sm` and a matching leading Lucide icon; destructive actions use error styling and Eraser. Avoid vague OK/Yes/No labels.
- Settings tabs group related rows within bordered cards. Omit internal row dividers consistently; use section headings, shared insets, proximity and hover/focus treatment to distinguish groups and interactive rows. Help & Support follows the same section spacing as Appearance and Shortcuts.
- Immediately applied settings/colours use contextual reset actions, without Save/Cancel. Settings and colours may close on backdrop click; editing and confirmation dialogs remain protected, especially while pending.
- Node name and description open together in the shared dialog above the property workspace. Keep the dialog host on the editing screen; Escape closes only the top dialog and restores focus to its trigger.

## Removal and inspection

- Confirmations state the consequence and reversibility. Emphasise affected names with semibold text rather than quotation marks; use translated keys/parameters, never interpolated HTML or a second decorative warning box.
- Project deletion explains that the entire project is removed and suggests export for backup. It does not enumerate model contents.
- For node/relation/level deletion, exclude the selected declaration from dependent counts and lists using both model and element identity. Hide zero-count consequences and their empty wrappers.
- Consequence statements open an adjacent detail surface in the same focus scope. Use a single compact Sushi List with noninteractive model headings/dividers, without nested cards. The left confirmation determines both heights; the slightly narrower details list scrolls inside its surface and stacks on narrow screens.
- Keep node/endpoint names prominent. Secondary text shows relation names and relevant counts: incident relations, own properties and constraints, including property constraints. Dependent levels show their own node/relation counts.
- Inspecting an entry pauses the action and navigates to the normal workspace. The persistent action notification near the bottom of the workspace offers Resume/Cancel. Navigation keeps it available; model changes invalidate it. See the [resumable workflow rules](editor-components.md#property-workspace-and-resumable-workflows).
- Escape closes details first and restores focus. Preserve the dialog-host sequence: open/measure the native dialog before expanding the adjacent surface. Measure the untransformed frame before window motion begins so positioning remains correct.

## Sushi integration

- Use public components, templates and styling tokens; keep behaviour in Sushi rather than duplicating it locally.
- `TooltipDirective` only aliases Sushi inputs. `noriTooltipSuspended` maps to the native `disabled` input for file-dialog actions and node transitions.
- Refinement creation uses `suiAccordionActions`. Keep actions outside the trigger and heading, with normal Tab order.
- Use Sushi’s native tab focus styles. Catalogue accordions retain the inset focus-offset token to keep outlines visible.
- Inline property rows use a circular Sushi `sm` icon button for Multiple values, with `aria-pressed`, primary active styling and a short translated descriptive tooltip. Use Sushi's native button feedback; do not add local state animations or delay persistence. Reuse cached Core level instances and their revision-aware validation results, and avoid graph notifications when colours have not changed. Focus within a row highlights the whole row, including drag handles and actions.
- Property datatype autocomplete opens all known types on focus/click, filters immediately and uses `forceSelection`. Only a confirmed known type updates the draft; Escape or blur discards unconfirmed text.
- Translate control labels, empty states, number-step labels and OrderList announcements through public inputs.
- The colour dialog keeps its size observer for centring after content changes. Removal details keep their measured opening sequence; both layouts have been checked with Sushi 0.2.0. Do not remove this positioning logic without checking the replacement.

Collect unresolved library issues and proposals in [Sushi feedback](sushi-feedback.md). After upgrading, reproduce each listed issue before changing its status or removing an integration workaround.

Design references: [Angular accessibility](https://angular.dev/best-practices/a11y), [W3C semantic structure](https://www.w3.org/WAI/tutorials/page-structure/). Project-specific spacing and interaction choices are defined above and in the shared components.
