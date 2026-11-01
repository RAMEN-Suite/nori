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

## Status notifications

- `NotificationService.show({ status, message, title?, action? })` is the entry point for relevant transient `error`, `warning`, `info` and `success` messages. It owns the translated default headings, soft variant, six-second duration and replacement in a single stable window. The app shell and model diagnostics use it; other callers should follow this pattern rather than inject Sushi ToastService directly.
- Share `styles/_feedback-surface.scss` between the upper status window and the lower resumable-action message: neutral overlay surface, subtle border, no shadow and a status-coloured icon tile. Upper status windows use a lightly status-tinted surface and border, compact spacing. Both message types use the shared content mixin: semibold `text-sm` headings, normal `text-xs` body text, a 0.125rem text gap, 0.625rem padding, a 0.875rem column gap and a 1.75rem icon tile. Keep these roles in the shared mixin rather than overriding each message type. Their headings are semibold in the same status colour; body text and action buttons stay neutral for readability. Error, warning, info and success use their semantic colour tokens. Do not add success messages for every routine inline save.
- The active view owns the outlet and placement. In the main workspace it appears at the top centre below the toolbar: 36rem maximum width with responsive viewport limits, at title-bar height plus the 4.5rem editor chrome height and a 1.25rem gap.
- `NotificationsComponent` with `context="node-editor"` anchors the same window inside the node workspace, one rem below its own header. Opening a native dialog leaves the active view’s general notification outlet mounted behind its backdrop; the message remains until dismissal or its normal timeout. Native dialogs do not host the general notification outlet or a general status banner. Keep input and shortcut validation in the relevant form area; do not move it into a generic dialog heading. The existing inline fallback for an actual failed dialog action remains local to that action. Only one outlet is active at a time; message content does not select screen coordinates.
- A new message replaces the current content and restarts its six-second timer. Keep the same window DOM node and update status, heading, text and action in place; never dismiss and enqueue to simulate replacement. Only arrival from an empty state and final dismissal animate. An older workflow may only dismiss its own message ID.
- Windows unfold horizontally like the toolbar (360ms entry, 200ms exit) without scaling text. Respect reduced motion and the app animation setting. The notification service owns auto-dismissal and pauses the timer while hovered or focused; a manual close action remains available.
- Input validation and resumable workflows retain their own contextual UI. A status notification supplements those interactions rather than replacing field errors or workflow controls.

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
