# Keyboard shortcut review

## Principles

- Reuse standard commands for their established meaning; protect browser, operating-system and assistive-technology bindings. [WAI keyboard interface guidance](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/).
- Single-character shortcuts need a way to turn them off, remap them with a non-character modifier, or limit them to the focused component. Nori provides remapping with Ctrl/Cmd and Alt in Settings. This supports that part of [WCAG 2.1.4](https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html); it is not a claim of full accessibility conformance.
- Preserve normal text editing and focused-widget interaction. Global shortcuts are blocked in inputs, editable text, dialogs, the property workspace, menus, listboxes, trees, grids, tablists, sliders, spinbuttons and radio groups. Ignore composition, AltGraph and repeated key events.
- `mod` means Cmd on macOS and Ctrl on Windows/Linux. Display uses native macOS modifier symbols (⌘, ⌥, ⇧) and text labels on Windows/Linux (Ctrl, Alt, Shift). Separate macOS keys with narrow nonbreaking spaces (⌘ Z, ⇧ ⌘ Z); separate Windows/Linux keys with spaced plus signs (Ctrl + Z). Tooltips and Settings share this formatter. `aria-keyshortcuts` keeps standard key names for assistive technology.

Conflicts never overwrite a binding silently. A nested confirmation names both actions; confirmation transfers the binding atomically, while Cancel or Escape leaves both unchanged. The previous action becomes unassigned until given another binding or defaults are restored.

## Default bindings

These letters are application choices, not shortcuts mandated by an accessibility standard.

| Area                                  | Binding               | Assessment                                                                                                                                                                    |
| ------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Refinements                           | R                     | Keep: mnemonic, configurable.                                                                                                                                                 |
| Base nodes                            | B                     | Keep: mnemonic, configurable.                                                                                                                                                 |
| Model levels                          | M                     | Keep: model mnemonic.                                                                                                                                                         |
| Inspector                             | I                     | Keep: inspector mnemonic.                                                                                                                                                     |
| Selection                             | V                     | Keep: familiar selection-tool convention.                                                                                                                                     |
| Relationships                         | L                     | Keep: line/link mnemonic.                                                                                                                                                     |
| Erase mode                            | E                     | Keep: erase mnemonic; switches mode rather than immediately deleting.                                                                                                         |
| Fit graph                             | F                     | Keep: fit mnemonic; Ctrl/Cmd+F remains available to Find.                                                                                                                     |
| Reset layout                          | Shift+R               | Keep separate from Fit. Ctrl/Cmd+R remains browser reload.                                                                                                                    |
| Colours                               | C                     | Keep: palette mnemonic; Ctrl/Cmd+C remains Copy.                                                                                                                              |
| Edit project                          | P                     | Keep: project mnemonic; Ctrl/Cmd+P remains Print.                                                                                                                             |
| Validate model                        | Shift+V               | Keep: validate mnemonic; Ctrl/Cmd+Shift+V remains available to Paste Special.                                                                                                 |
| Export model                          | Ctrl/Cmd+Shift+E      | Keep: explicit export command. Browser/OS conflicts can vary; the toolbar action and remapping remain available.                                                              |
| Export SVG                            | Shift+S               | Keep: format-specific convenience; Ctrl/Cmd+S and Ctrl/Cmd+Shift+S are not intercepted.                                                                                       |
| Export PNG                            | Shift+P               | Keep: format-specific convenience; Ctrl/Cmd+P is not intercepted.                                                                                                             |
| Settings, desktop                     | Ctrl/Cmd+,            | Adopt the Preferences convention documented by [Apple](https://support.apple.com/en-us/102650) and [GNOME](https://developer.gnome.org/hig/reference/keyboard.html).          |
| Settings, browser                     | ,                     | Retain: Chrome on macOS already owns Cmd+, for browser Settings. See [Chrome keyboard shortcuts](https://support.google.com/chrome/answer/157179?hl=en).                      |
| Undo model change                     | Ctrl/Cmd+Z            | Keep the conventional Undo binding. Restores committed model edits, including cascaded removals, within the current project session. Native text editing keeps its own Undo.  |
| Redo relationship                     | Ctrl/Cmd+Shift+Z      | Keep the cross-platform Redo convention.                                                                                                                                      |
| Alternative Redo                      | Ctrl+Y, Windows/Linux | Keep. Do not resolve the default Cmd+Y on macOS, where Chrome uses it for History; hide that redundant default row there. An existing alternative custom binding is retained. |
| Cancel action/tool or clear selection | Escape                | Cancels the visible action, otherwise exits the active tool, otherwise clears the inspector selection. Dialogs and focused widgets retain their own Escape handling.          |

The editor's visible Back button returns to the start screen. There is no Back hotkey: Alt+Left stays available for native browser history navigation. Old saved `back` overrides are ignored without affecting the remaining bindings.

## Compatibility

Saved custom bindings remain in place. A desktop upgrade to the Settings default does not take Ctrl/Cmd+, away from an existing customized action: retain the previous comma default in that case. Browser Settings stays on comma. No browser/OS shortcut is claimed to be universally available; a browser may consume it before the page receives a key event.

The explicit secondary Control modifier on macOS and OS/Meta modifier elsewhere are not treated as the primary `mod` key. Nori's current shortcut editor supports the primary command modifier, Alt and Shift; it does not expose separate secondary-modifier bindings.

## Verification scope

Check the binding resolver against Mac and Windows/Linux modifiers, AltGraph and composition, restore custom bindings, check conflicts and Settings defaults in desktop/browser contexts, then compile templates and build. Native browser/OS shortcut interception and spoken screen-reader output require separate runtime verification; source inspection and resolver tests alone do not prove those behaviours.
