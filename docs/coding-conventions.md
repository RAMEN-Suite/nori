# Coding conventions

Shared coding style for Nori and related libraries. General principles transfer to other languages; the TypeScript and Angular rules describe this project's stack. See the [Editor guide](editor-components.md) for ownership and extension paths, and [UI guidelines](ui-guidelines.md) for presentation.

## Keep the design simple

- Give each component, service or module one coherent responsibility and a small API. Extract behaviour when it has its own purpose, not merely to reduce line counts.
- Prefer composition and pure functions. Use classes for state, lifecycle or invariants; cohesive static namespaces remain acceptable.
- Keep domain rules separate from UI and persistence. Put a shared rule in one owner; do not build speculative abstractions or generic components with many modes.
- Preserve existing conventions in maintained files. Avoid unrelated renaming, formatting and architectural changes.

## Names, formatting and imports

| Element                           | Adopted style                                                             |
| --------------------------------- | ------------------------------------------------------------------------- |
| Types and classes                 | PascalCase                                                                |
| Methods, parameters and variables | camelCase; concrete verbs for actions                                     |
| Booleans                          | `isPending`, `canEdit`, `hasChanges`                                      |
| Shared fixed constants            | UPPER_SNAKE_CASE; ordinary readonly values stay camelCase                 |
| Collections and lookups           | Plural nouns; descriptive keys such as `nodesById`                        |
| Formatting                        | 2 spaces, LF, final newline, single-quoted TypeScript strings, semicolons |
| Wrapping                          | Prettier owns expression wrapping; configured widths are 130, HTML 140    |

- Write identifiers and technical documentation in English; translate product text.
- Distinguish IDs, qualified references, indexes, counts and units in names.
- Keep imports first: framework/runtime, external packages, project modules. Mark type-only imports explicitly; injection tokens remain runtime imports.
- Use public package entry points. Avoid private package paths, unused imports and duplicate Angular metadata entries.
- Keep feature files together. Nori retains `.component`, `.service`, `.directive`, `.dialog` and `.screen` suffixes; existing contract and Electron filenames retain their established style.
- Use `.ts` for application sources. Standalone Node build scripts use `.mts` when they need explicit ESM semantics alongside the CommonJS Electron process.

## Methods and blank lines

**Compact within one step; one blank line between distinct steps.**

- Keep a lookup and its immediate guard together. Related guards also stay together.
- Separate completed preparation/validation from the next mutation, persistence operation or result handling when they form distinct phases.
- Short declaration/check/return methods remain compact. Do not require a blank line after every `const` or `await`, or before every `return`.
- A substantial multiline expression may end a group; being multiline alone does not require an empty line.
- Avoid empty lines directly inside braces and between `try`, `catch` and `finally`. Prettier wraps expressions; the author chooses logical paragraphs.

```ts
const relation: Relation | undefined = draft.getRelation(id);
if (!relation) return;

const preview: RelationRemovalPreview = this.workspace.actions.previewRelationRemoval(id);
```

Use guard clauses instead of deeply nested branches. Extract meaningful operations, not trivial wrappers. Avoid cryptic boolean mode arguments and nested ternaries. Nori's lint limits are complexity 12 and 40 nonblank, noncomment lines per function; these are project thresholds, not universal design rules.

## Types, classes and state

- Use strict checking. Accept untrusted JSON, storage and IPC data as `unknown` and validate it at the boundary; a type annotation does not validate runtime input.
- Explicitly type fields, variables, parameters and returns, including primitive locals. Contextually typed arrow parameters and destructuring may use inference where lint permits it. This is the adopted author style.
- Declare generic constructors on the variable: `const groups: Map<number, Item[]> = new Map();`.
- Avoid `any`, unchecked casts and expression non-null assertions. `as const` and framework-required definite assignment are deliberate exceptions.
- Make absence and valid states explicit. Prefer literal/discriminated unions for finite states; use `??` when only absence should trigger a default.
- Declare visibility explicitly: public APIs, protected template bindings, private implementation. Use readonly references and collections where mutation is not intended; readonly does not imply a runtime deep freeze.
- Group members by dependencies, inputs/configuration, state, derived values, lifecycle, actions and helpers. Use blank lines, not decorative section comments.
- Give mutable state one owner. Expose readonly views where practical and derive values instead of maintaining stale copies.
- Use standalone OnPush Angular components, signals, `inject` and host metadata. Effects synchronise external systems; computed signals derive state.

## Async work, errors and resources

- Await dependent operations in order; parallelise only independent work. Guard duplicate submissions and serialise conflicting writes.
- Capture project/model/selection identity before awaiting and recheck context or revision before applying a result. Treat cancellation as an expected outcome.
- Handle promise rejections, including deliberate fire-and-forget calls. Catch where an error can be recovered from, reported or translated into UI feedback.
- Distinguish invalid input, expected absence and unexpected failure. Keep the previous valid state on failure; do not fabricate a plausible fallback that hides a broken invariant.
- Validate proposed model changes before mutation and use transactions for writes that must succeed together.
- Keep cleanup with resource creation: listeners, observers, subscriptions, timers and animations need an owner and lifecycle cleanup.
- Keep privileged Electron operations behind narrow, validated IPC capabilities. Do not log secrets or entire imported documents.

## Comments, documentation and libraries

- Prefer clear names over narration. Explain responsibility, non-obvious reasons, invariants and temporary workarounds; remove dead code and obsolete comments.
- Keep extension guidance in short Markdown sections organised by task. Update documentation when ownership or APIs change.
- A library exposes only supported entry points and contracts. Document inputs, mutation, errors, runtime support and compatibility; test the packaged consumer, including declarations and exports.
- Keep domain libraries independent of Angular, Electron, the DOM and browser storage. Supply runtime adapters at the boundary.

## Verification and commits

- Run `npm run verify`: lint, formatting, all TypeScript checks and both builds. Configuration files are authoritative; update docs and tooling together.
- Test observable behaviour and actual regression risks, especially mutations, persistence, migrations, concurrency and public APIs. Compilation alone is not a behavioural test.
- For UI changes, check keyboard navigation, focus, long/translatable text, overflow and reduced motion. See [UI guidelines](ui-guidelines.md).
- Keep changes reviewable. Use Commitlint-validated `type(scope): description`; scopes are `editor`, `desktop`, `tools`, `deps`, `release`.
- Report checks not run and unresolved warnings honestly. Keep supported Node/npm versions and the lockfile consistent with CI.

Tooling lives in `.editorconfig`, `.prettierrc`, `eslint.config.mjs`, the project tsconfigs, `.nvmrc` and `commitlint.config.cjs`. Lint enforces explicit typing/visibility, type-only imports, readonly private references and unique Angular metadata entries. Semantic paragraphs and responsibility boundaries still require review.

## References

Technical guidance: [TypeScript strict checking](https://www.typescriptlang.org/tsconfig/strict.html), [Angular style guide](https://angular.dev/style-guide), [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [Node package entry points](https://nodejs.org/api/packages.html#package-entry-points), [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). Naming, annotations and spacing are the adopted author preferences.
