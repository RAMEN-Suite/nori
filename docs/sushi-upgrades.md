# Sushi upgrades

## 0.2.0 → 0.2.1

Installed the published `@sushi-kit/angular` 0.2.1 package. `package.json` requires `^0.2.1`; the lockfile pins 0.2.1 and its registry integrity hash. Peer dependency ranges remain compatible with Nori's Angular 22 setup. No other installed package changed.

### Integration changes

- Bind each custom List template to its typed item source with `[suiListItem]`. The new context guards expose previously unchecked template values as `unknown` when the source is omitted. Keep strict Angular template checking enabled.
- Narrow removal-preview entries to their actual node, relation or model-level type before rendering their fields. The stricter List context revealed an existing assumption that the selected category would narrow the item union.
- Keep the shared property-options template's source typed by choosing the component's bounds or usage collection explicitly.
- Use Autocomplete's new public `suggestionsMessage` callback in both the inline datatype control and the detailed property form. Nori supplies singular/plural translations for English, German and Italian. No internal DOM overrides or additional live region are needed.

### Styling and behaviour examined

Compared the installed 0.2.0 and 0.2.1 public declarations, global stylesheet and compiled component implementation; the adjacent Sushi source history helped identify the corresponding changes.

- Sushi now supplies a shared `--sui-font-size-*` scale and applies it across components. Several controls use more compact spacing; List size controls spacing independently of text size. Existing rem-based Nori scaling remains active. These upstream changes can visibly affect controls, menus, category headings and dialogs.
- Disabled states use the shared opacity token; focus-ring width uses rem rather than em. No additional Nori focus or animation overrides were introduced for this upgrade.
- Every Sushi token referenced by Nori that existed in 0.2.0 is still present in the 0.2.1 package. Existing application-specific tokens and scoped layout rules remain.
- The upstream context-menu pointer-release fix is included. Nori's OrderList handle menu remains open after a click and closes with Escape.
- Current dialog motion and notification placement remain application choices. This update does not replace those behaviours.

### Verification

- Lint, TypeScript checks and Angular production build pass. The existing graph stylesheet budget warning remains (5.88 kB against 4 kB).
- Browser smoke checks in the local `Typography Prüfung` project: inspector lists, node property workspace, category collapse/reopen, OrderList handle menu, new-row multiple-values toggle, property detail dialog, settings dialog, and removal confirmation with the affected-node list. Removal was cancelled; existing model data was retained.
- German autocomplete announcements observed in the accessibility tree: `11 Vorschläge verfügbar.` and `1 Vorschlag verfügbar.`. The existing String selection was accepted with Enter. English and Italian strings are included but were not separately exercised with a screen reader.
- No desktop packaging, signed build, drag reorder persistence or exhaustive visual comparison was performed for this update.

### Installation policy

Because this release was newer than the configured three-day minimum age, the requested installation used a one-command `--min-release-age=0` exception. Lifecycle scripts remained disabled. Repository `.npmrc`, CI policy and the local Core dependency metadata were preserved.
