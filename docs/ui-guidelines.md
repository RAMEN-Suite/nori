# UI guidelines

Shared rules for Nori panels, dialogs and lists. Use public Sushi APIs and tokens; implementation ownership is described in the [Editor guide](editor-components.md).

## Shared components and accessibility

- Use semantic buttons, links, headings, groups and lists. Icon-only controls need accessible names; decorative icons are hidden from assistive technology. Avoid nested buttons and hover-only actions.
- Reuse panel/dialog frames, typography, list spacing and tooltips. Comparable bordered lists use `styles/_surface-list.scss` mixins with Sushi List; keep dimensions in shared styles rather than repeating numbers here.
- Keep focus visible without clipping it. Support keyboard navigation, long/translatable text, small viewports and zoom.
- Keep headings and bottom actions fixed; scroll the content area. Use shared scroll hints only when content overflows, with room for the scrollbar and focus rings.
- Respect reduced motion and the user's animation preference. Keep shared motion in its owner; dialogs currently open with a 280ms fade/6px upward movement and close with a short 180ms fade.

## Dialogs and forms

- Use short, specific sentence-case titles that describe the task or decision. Plain titles have no decorative icon or forced uppercase. Avoid generic “Warning” and “Are you sure?”.
- Centre ordinary dialogs and respect the viewport. Use shared compact/form sizing; the property workspace is a dedicated overlay, not a nested dialog.
- Follow the node-colours dialog's calm style: clear introduction, thin bordered content area and compact actions. Use feedback boxes for feedback, not decorative instructions.
- Keep labels above full-width controls, validation inline and near its context, and enough inset for focus rings. Translate all visible text.
- Put actions bottom right: neutral Cancel first, one specific primary action last. Use Sushi button size `sm` and a matching leading Lucide icon; destructive actions use error styling and Eraser. Avoid vague OK/Yes/No labels.
- Immediately applied settings/colours use contextual reset actions, without Save/Cancel. Settings and colours may close on backdrop click; editing and confirmation dialogs remain protected, especially while pending.
- Edit inside the existing surface; never open editing dialogs inside dialogs.

## Removal and inspection

- Confirmations state the consequence and reversibility. Emphasise affected names with semibold text rather than quotation marks; use translated keys/parameters, never interpolated HTML or a second decorative warning box.
- Project deletion explains that the entire project is removed and suggests export for backup. It does not enumerate model contents.
- For node/relation/level deletion, exclude the selected declaration from dependent counts and lists using both model and element identity. Hide zero-count consequences and their empty wrappers.
- Consequence statements open an adjacent detail surface in the same focus scope. Use a single compact Sushi List with noninteractive model headings/dividers, without nested cards. The left confirmation determines both heights; the slightly narrower details list scrolls inside its surface and stacks on narrow screens.
- Keep node/endpoint names prominent. Secondary text shows relation names and relevant counts: incident relations, own properties and constraints, including property constraints. Dependent levels show their own node/relation counts.
- Inspecting an entry pauses the action and navigates to the normal workspace. The persistent action notification above the version footer offers Resume/Cancel. Navigation keeps it available; model changes invalidate it. See the [resumable workflow rules](editor-components.md#property-workspace-and-resumable-workflows).
- Escape closes details first and restores focus. Preserve the dialog-host sequence: open/measure the native dialog before expanding the adjacent surface. Keep its outer frame/body untransformed so measurement and positioning remain correct.

## Sushi integration and upgrade checks

Baseline: `@sushi-kit/angular` 0.1.4. These are observed limitations or missing capabilities, not all confirmed library defects. Recheck after upgrading before removing a workaround.

### Tooltip focus restoration

The installed Tooltip schedules showing on `focusin` and `mouseenter`, without distinguishing restored focus or dismissing on activation. Reproduce by opening an export menu/native save dialog, closing it and waiting for the tooltip delay.

Nori's `TooltipDirective` dismisses on activation and suppresses restored menu/dialog focus; `noriTooltipSuspended` covers pending native-dialog actions such as JSON export. Keep focus restoration and deliberate keyboard tooltips. Remove the local workaround only when Sushi's public interaction policy covers activation, restored focus and overlay-generated hover events; test selection, Escape, outside click, save/cancel and subsequent normal focus/hover.

### Other limitations

| Area                | Current handling and upgrade check                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Autocomplete        | No public full-list open-on-focus/click API. Keep Sushi Select for fixed Core type choices until opening, immediate filtering and valid selection are supported.                      |
| Searchable Select   | No built-in filter; an input in the header was observed to close the popup on focus. Check typing, selection and Escape before adopting a search header.                              |
| Dialog resizing     | Previously observed locked initial positioning. Check short-to-tall content and restored removal details; use a public resize/reposition API, not forced reopening or private styles. |
| Accordion focus     | Clipped outward outlines use the public inset focus-offset token. Check expanded/collapsed headers and first/last entries.                                                            |
| Tabs                | Settings styles the public tabpanel role until consistent panel-focus tokens are available.                                                                                           |
| Category actions    | Keep the add action a sibling of the accordion trigger, with predictable tab order. Adopt a public action slot when available.                                                        |
| Number input labels | Installed increment/decrement labels are English. Check for public translated-label inputs for German, English and Italian.                                                           |

Design references: [Angular accessibility](https://angular.dev/best-practices/a11y), [W3C semantic structure](https://www.w3.org/WAI/tutorials/page-structure/). Project-specific spacing and interaction choices are defined above and in the shared components.
