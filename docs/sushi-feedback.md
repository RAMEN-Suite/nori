# Sushi feedback

Collect unresolved Sushi issues and proposals found while integrating Nori. Keep confirmed defects separate from feature requests. Remove resolved entries after upgrading and verifying them in Nori; Git history retains the earlier reports.

For each new entry, record the affected version, component, reproduction, actual and expected behaviour, and any local workaround. Do not mark a fix verified from an API declaration or a successful build alone.

## Autocomplete: translate the suggestion-count announcement

**Status:** confirmed localisation gap in `@sushi-kit/angular` 0.2.0.

### Reproduce

1. Set Nori’s language to German or Italian.
2. Open an editable property’s datatype autocomplete.
3. Inspect the accessible live region or listen with a screen reader; type to change the number of suggestions.

**Actual:** the live region contains hardcoded English text such as `11 suggestions available.` and `1 suggestions available.`. The input label, placeholder and empty-state text are translated correctly through public inputs.

**Expected:** consumers can translate the count announcement, including singular/plural forms, without replacing Sushi’s internal DOM.

**Proposal:** expose a public count formatter, for example `suggestionsMessage: (count: number) => string`, following the configurable announcement pattern used by OrderList. This is a proposed API, not an existing input.

**Evidence:** the installed package’s Autocomplete template in `node_modules/@sushi-kit/angular/fesm2022/sushi-kit-angular.mjs` renders `filteredOptions().length` followed by the English literal. Its public declarations expose `emptyMessage`, `loadingMessage` and `errorMessage`, but no count formatter. The English live text was also observed in Nori’s German accessibility tree; spoken VoiceOver output has not been tested.

**Nori handling:** no DOM override or duplicate live region. Keep using the translated public labels and adopt the formatter when Sushi provides it.
