# UI guidelines

Shared rules for Nori panels, dialogs and lists. Use public Sushi APIs and tokens; implementation ownership is described in the [Editor guide](editor-components.md).

## Shared components and accessibility

- Use semantic buttons, links, headings, groups and lists. Icon-only controls need accessible names; decorative icons are hidden from assistive technology. Avoid nested buttons and hover-only actions.
- Reuse panel/dialog frames, typography, list spacing and tooltips. Comparable bordered lists use `styles/_surface-list.scss` mixins with Sushi List; keep dimensions in shared styles rather than repeating numbers here.
- Unexpected errors use the shared bottom-right Toast outlet. Native dialogs and the property workspace host the outlet inside their focus scope; otherwise the app shell owns it. Field validation stays beside the input.
- Keep focus visible without clipping it. Support keyboard navigation, long/translatable text, small viewports and zoom.
- Keep headings and bottom actions fixed; scroll the content area. Use shared scroll hints only when content overflows, with room for the scrollbar and focus rings.
- Respect reduced motion and the user's animation preference. Keep shared motion in its owner; dialog windows enter as one surface over 250ms with a scale from 70%, a slight overshoot and a fade, and leave over 100ms. Start window movement after initial positioning; do not animate dialog contents separately.

## Dialogs and forms

- Use short, specific sentence-case titles that describe the task or decision. Plain titles have no decorative icon or forced uppercase. Avoid generic “Warning” and “Are you sure?”.
- Centre ordinary dialogs and respect the viewport. Use shared compact/form sizing; the property workspace is a dedicated overlay, not a nested dialog.
- Follow the node-colours dialog's calm style: clear introduction, thin bordered content area and compact actions. Use feedback boxes for feedback, not decorative instructions.
- Keep labels above full-width controls, validation inline and near its context, and enough inset for focus rings. Use `nori-field-label` for field labels (0.875rem, medium) and `nori-field-optional` inline for optional markers. Hints and counters use smaller, regular text. Translate all visible text.
- Definition descriptions use the shared field and the Core `DESCRIPTION_MAX_LENGTH` limit, counting Unicode code points. Show the counter and over-limit errors beside the textarea; never truncate pasted or imported text. Project descriptions use the same field and UI limit; Core treats project metadata separately from model definitions.
- Enter in a form input submits through the same guarded save/create action as its footer button. Autocomplete/select controls handle selection first; multiline fields keep Enter for new lines.
- Put actions bottom right: neutral Cancel first, one specific primary action last. Use Sushi button size `sm` and a matching leading Lucide icon; destructive actions use error styling and Eraser. Avoid vague OK/Yes/No labels.
- Immediately applied settings/colours use contextual reset actions, without Save/Cancel. Settings and colours may close on backdrop click; editing and confirmation dialogs remain protected, especially while pending.
- Edit inside the existing surface; never open editing dialogs inside dialogs.

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
- Property datatype autocomplete opens all known types on focus/click, filters immediately and uses `forceSelection`. Only a confirmed known type updates the draft; Escape or blur discards unconfirmed text.
- Translate control labels, empty states, number-step labels and OrderList announcements through public inputs.
- The colour dialog keeps its size observer for centring after content changes. Removal details keep their measured opening sequence; both layouts have been checked with Sushi 0.2.0. Do not remove this positioning logic without checking the replacement.

Collect unresolved library issues and proposals in [Sushi feedback](sushi-feedback.md). After upgrading, reproduce each listed issue before changing its status or removing an integration workaround.

Design references: [Angular accessibility](https://angular.dev/best-practices/a11y), [W3C semantic structure](https://www.w3.org/WAI/tutorials/page-structure/). Project-specific spacing and interaction choices are defined above and in the shared components.
