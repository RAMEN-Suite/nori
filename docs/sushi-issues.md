# Open Sushi issues

Baseline: `@sushi-kit/angular` 0.1.4. Recheck these observations after upgrading; distinguish missing public APIs from defects. Use public APIs rather than private DOM access or internal component state.

### Tooltip: activation and restored focus

- The installed Tooltip schedules showing on every `mouseenter` and `focusin`. It does not dismiss on activation or distinguish deliberate keyboard focus from focus restored after a menu or native save dialog.
- Reproduction: activate a tooltip-bearing export control, close its menu or native save dialog, and wait for the show delay. The tooltip can reappear even though no new help was requested.
- This is an interaction-policy gap; displaying tooltips for keyboard focus remains useful. Focus restoration itself should be retained.
- NORI's shared tooltip directive dismisses on activation, suppresses menu restoration, and accepts `noriTooltipSuspended` for pending native-dialog actions such as JSON export. Normal hover/focus resumes after leaving the control once the action has finished.
- A Sushi-level solution should expose a restoration/interaction policy or coordinate with its overlay triggers. Avoid removing keyboard tooltips globally or blurring the trigger to hide the problem.

### Autocomplete: opening the complete list

- Missing API: `sui-autocomplete` opens suggestions on input or keyboard interaction, but offers no public open method or open-on-focus/click option. With an existing value, filtering initially follows that label rather than showing every option.
- Desired behaviour: focus or click shows all choices, typing immediately narrows them, selection commits a valid option, and Escape restores the previous selection. Retain `forceSelection` for fixed choices such as Core data types.
- NORI currently uses `sui-select`; the experimental local search-select implementation has been removed.

### Select: searchable choices and header focus

- Missing API: `sui-select` has no built-in search/filter input. The Listbox component supports filtering, but Select does not expose equivalent functionality.
- Observed integration problem: adding an ordinary search input through the public Select header template closes the popup when that input receives focus. Reproduce by opening a Select with a header input and clicking into it.
- A supported searchable Select should keep the popup open during filtering and preserve keyboard selection, focus restoration and Escape behaviour.

### Dialog: positioning after content resize

- Previously observed: dialogs lock their initial position. Moving from a short list to a taller form grows the dialog downwards instead of keeping it centred. Reproduction flow: Edit annotations → Add annotation type; recheck when that flow is available.
- Requested API: optional recentering on content resize, preserving deliberate dragging, or a public reposition method.
- NORI preserves the opening/measurement order when restoring removal reviews with an adjacent detail surface. Avoid forced reopening or private dialog styles.

### Accordion: focus within clipped containers

- Previously observed: trigger focus outlines extend outside clipped collapse containers. Check expanded/collapsed triggers and the first and last items with keyboard navigation.
- NORI uses the public focus-offset token to keep the outline inside. Sushi could offer an inset focus option for clipped containers.

### Tabs: panel focus styling

- Previously observed: tab panels use browser-default focus outlines without a dedicated panel focus token.
- NORI styles the public tabpanel role in Settings. Sushi should expose consistent panel focus styling tokens.

### Accordion: sibling category actions

- Missing extension point: the catalogue needs a category trigger and a separate add action with a predictable tab order, without nesting interactive controls.
- NORI retains its explicit category-plus-action layout. A public sibling action slot with documented keyboard behaviour would make reuse possible.

### Number input: button labels

- The default increment/decrement labels are English (`Increase`/`Decrease`) in the installed version. Verify whether the next version offers direct translated-label inputs; NORI needs German, English and Italian labels.
- This is a localisation gap to check, not a numeric stepping defect. Keep the standard number control and its bound checks.
