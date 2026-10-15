# TypeScript conventions

Reusable conventions derived from Nori's code style and reviewed against the references below. Use this document as a baseline for other applications and libraries; keep framework and runtime decisions in a project supplement.

## 1. Scope and decisions

- **Required** rules protect correctness, public contracts, accessibility or maintainability.
- **Style** rules establish a consistent way of writing code. Explicit local types, file suffixes and import groups are deliberate preferences, not universal requirements of TypeScript.
- **Project-specific** rules belong in a supplement. Angular injection, Sushi components, database storage and Nori's model semantics are examples.
- Automated configuration is authoritative for formatting and compiler checks. Update configuration and documentation together when a rule changes.
- Follow the existing convention in a maintained file. Change a convention deliberately across its actual scope, rather than introducing a second style in one feature.

## 2. Design principles

- Choose the simplest explicit solution that meets the current requirement. Do not add extension points for hypothetical callers.
- Give each module a coherent responsibility and a small interface. A file being long is a prompt to inspect responsibilities, not a reason to split it arbitrarily.
- Keep dependencies directed: domain rules do not depend on presentation or persistence implementations. Application workflows coordinate those boundaries.
- Put a business rule in one authoritative place. A small repeated presentation detail does not automatically justify a generic framework.
- Prefer composition and plain functions. Use classes for state, lifecycle, invariants or a cohesive existing API.
- Introduce an interface when it describes a useful contract or boundary. Do not create an interface for every class.
- Avoid hidden mutable globals, dependency cycles, unrelated utility collections, excessive coupling and speculative generalisation. Apply KISS and the concerns behind STUPID pragmatically.

## 3. Naming and language

| Element                                   | Convention                                       | Example                              |
| ----------------------------------------- | ------------------------------------------------ | ------------------------------------ |
| Types, interfaces, classes, enums         | PascalCase                                       | `ProjectRecord`                      |
| Functions, methods, parameters, variables | camelCase                                        | `resolveModelName`                   |
| Booleans                                  | State or question                                | `isPending`, `canEdit`, `hasChanges` |
| Shared fixed constants                    | UPPER_SNAKE_CASE                                 | `PROPERTY_NAME_MAX_LENGTH`           |
| Ordinary readonly values                  | camelCase                                        | `defaultState`                       |
| Collections                               | Plural noun                                      | `models`, `selectedIds`              |
| Maps                                      | Describe lookup                                  | `nodesById`                          |
| Files                                     | Follow the project's established role convention | `project-repository.service.ts`      |

- Write code identifiers and technical documentation in English. Localise product text separately.
- Name actions with concrete verbs: `load`, `save`, `remove`, `preview`, `validate`. Avoid `handleData`, `processStuff` and vague manager classes.
- Distinguish an identifier, index, position, count and reference in the name. Include units where ambiguous, such as `delayMs`.
- Use `find` for an optional result and `require` for a result whose absence is an error. Keep existing domain terminology when an API already establishes it.
- Do not prefix interfaces with `I`, private members with underscores, or implementations with `Impl` without an actual naming need.
- Prefix an intentionally unused callback parameter with `_` only when the signature requires it.
- Use domain names consistently; do not alternate between synonyms for the same concept within an API.

## 4. Files, modules and imports

- Keep one main responsibility per file. Small private types and helpers may stay with their only consumer.
- Group related features together. Move code to shared modules only when its responsibility is genuinely shared.
- Keep imports at the top: framework/runtime, external packages, then project modules. Follow local grouping; do not add a sorting tool merely to reorder untouched imports.
- Use `import type` or inline `type` imports for type-only dependencies where the framework does not need a runtime value.
- Import runtime values used by decorators or dependency injection normally.
- Remove unused imports and duplicate dependencies, including component metadata imports.
- Use public package entry points. Avoid imports into another package's private source or build directories.
- Avoid internal barrel imports that hide cycles. Reserve barrels for deliberate public entry points or a cohesive feature boundary.
- Keep runtime side effects out of module imports unless the module explicitly represents application bootstrap or registration.

## 5. Formatting

Use the project's formatter instead of manually negotiating whitespace. Nori's reusable style is:

| Setting                     | Value                    |
| --------------------------- | ------------------------ |
| Indentation                 | 2 spaces                 |
| Encoding and line endings   | UTF-8, LF, final newline |
| TypeScript strings          | Single quotes            |
| Semicolons                  | Yes                      |
| Trailing commas             | Wherever supported       |
| Arrow parameter parentheses | Always                   |
| Object brace spacing        | Yes                      |
| Preferred line width        | 130; Angular HTML 140    |
| CSS strings                 | Double quotes            |

- Separate responsibilities with blank lines. Keep closely related statements together.
- Let the formatter wrap expressions. Split a complicated expression into named steps when wrapping alone does not make it readable.
- Avoid decorative section comments and alignment with spaces. Use headings in documentation instead.

### Blank lines inside methods

The recurring Nori pattern is **compact within one step, one blank line between distinct steps**. It is a semantic grouping preference, not a blank line after every declaration, guard or `await`.

- Keep a lookup and its immediate guard together. Consecutive guards checking the same precondition also stay together.
- Separate completed preparation/validation from the operation that uses the validated data when they form distinct phases.
- Keep a short, continuous sequence compact. A declaration, check and return can be one group; a simple return does not require a preceding blank line.
- After a substantial multiline transformation or configuration object, a blank line often separates the next operation or final result. A multiline expression alone does not mandate a blank line.
- Use one empty line between groups. Avoid empty lines directly inside opening/closing braces, between every statement, or between `try`, `catch` and `finally` clauses.
- Let Prettier choose expression wrapping, argument layout and method-chain line breaks. The author chooses the meaningful statement groups; formatting does not infer those groups.

Examples from the current code:

```ts
const relation: Relation | undefined = draft.getRelation(id);
if (!relation) return;

const preview: RelationRemovalPreview = this.workspace.actions.previewRelationRemoval(id);
```

The lookup and guard are one step; preparing the removal starts the next. Short methods remain compact:

```ts
private requireContext(): WorkspaceContext {
  const context: WorkspaceContext | null = this.workspace.context();
  if (!context) throw new Error(this.translations.translate('editor.modelChanged'));
  return context;
}
```

These patterns occur in `RelationEditingService`, `ProjectService.loadProject` and the model-name helpers. They describe the recurring style; existing methods do not apply a rigid, identical spacing template.

## 6. Types and contracts

- Enable strict TypeScript checking, including unchecked indexed access and unknown catch variables where supported.
- Do not use `any` to bypass an unclear contract. Accept `unknown` at untrusted boundaries and narrow it through validation.
- Treat JSON, storage, IPC, URL parameters and imported files as runtime data. A TypeScript annotation does not validate their contents.
- Prefer literal unions and discriminated unions for finite states. Avoid independent boolean flags that permit impossible combinations.
- Use interfaces for object contracts and type aliases for unions, mapped types and other compositions. Follow existing local usage when both forms fit.
- Use `readonly` fields and collections when callers should not mutate them. Remember that `readonly` is not a runtime freeze or automatic deep immutability.
- Distinguish absence from an intentionally empty value. Choose `undefined` or `null` according to the contract and keep that choice consistent within it.
- Prefer `??` when only absence should trigger a default. Use `||` when all falsy values should do so.
- Narrow before accessing a collection entry. Do not assume `find`, array indexing or map lookup succeeds.
- Avoid unchecked `as` casts and expression non-null assertions. `as const` is useful for preserving literal contracts.
- A framework-required definite assignment field may be justified when its lifecycle guarantees initialisation. Keep the guarantee local and understandable.
- Use generics when the relationship between input and output matters. Avoid generic parameters that merely make a simple API harder to read.
- Consider branded identifiers only when mixing structurally identical IDs creates a recurring risk; descriptive names and boundary validation come first.

### Explicit typing: the adopted personal style

- Declare variable, field, parameter and function return types explicitly, including primitive locals. This is a readability preference adopted from Nori.
- Contextually typed arrow parameters and destructuring may use inference where the lint configuration permits it.
- Type generic constructors on the declaration: `const nodesById: Map<string, NodeRecord> = new Map();`.
- Do not repeat a generic argument on both the declaration and constructor without a type-system reason.
- Keep exported signatures explicit even in a library that relaxes local annotations. Avoid accidentally exposing an inferred dependency type.

```ts
interface NamedItem {
  readonly id: string;
  readonly name: string;
}

export function findItem(items: readonly NamedItem[], id: string): NamedItem | undefined {
  return items.find((item: NamedItem): boolean => item.id === id);
}
```

## 7. Classes, functions and control flow

- Declare member visibility explicitly. Expose the smallest useful API; keep implementation details private.
- Mark references readonly when reassignment is unnecessary. A readonly reference can still point to mutable state.
- Group class members by responsibility: dependencies, inputs/configuration, state, derived values, construction/lifecycle, public actions, private helpers. Do not add narration comments for these groups.
- Prefer short methods with guard clauses. Keep the normal path readable without several nested conditions.
- Extract a helper when its name expresses a useful operation or it owns a separate rule. Do not split a straightforward sequence into trivial wrappers.
- Avoid boolean mode parameters such as `save(true, false)`. Use a named options object when a function needs several independent options.
- Prefer explicit branches over nested ternaries. Use a `switch` or lookup for a clear finite mapping.
- Make invalid state difficult to construct. Validate invariants at the owning boundary, before changing live data.
- Preserve meaningful order in collections; never rely on accidental object iteration order for a domain rule.
- Use a cohesive static namespace when it matches the existing API; use a plain function for a small independent calculation. Neither pattern should become a catch-all.

## 8. State, mutation and persistence

- Make ownership visible: one service, store or object owns a piece of mutable state.
- Expose readonly views where possible and named operations for changes. Document deliberate mutable APIs.
- Derive values from their source rather than maintaining another copy that can become stale.
- Keep pure calculations separate from I/O and UI coordination. Pass their inputs explicitly.
- Validate a proposed change before applying it. Use transactions for writes that must succeed together.
- Keep storage records and migrations at the persistence boundary; do not spread legacy field names through new domain code.
- Do not treat serialisation as a universal cloning or equality strategy. It is acceptable for bounded, JSON-compatible snapshots with a defined purpose.
- Document whether an operation mutates inputs, returns a copy, persists immediately or only stages a change.

## 9. Async work and resource lifecycle

- Return promises for asynchronous operations. Await dependent operations in order; run independent work concurrently only when shared state permits it.
- Guard duplicate submissions and serialise conflicting writes. Do not assume completion order matches request order.
- Capture the relevant identity and verify it after awaiting: selected item, project, model, revision or request token.
- Use cancellation when supported. Cancellation is a normal outcome, not automatically a user-facing error.
- Handle every promise rejection. A deliberate fire-and-forget call still needs an error boundary.
- Keep cleanup with resource creation: unsubscribe, disconnect observers, remove listeners, clear timers and cancel pending work at the owning lifecycle boundary.
- Prefer platform or framework lifecycle tools over custom subscription registries.
- Avoid `async` callbacks passed to APIs that do not await them unless rejection and completion are handled explicitly.

## 10. Errors, validation and logging

- Distinguish invalid user input, expected absence, cancellation and unexpected failure.
- Return structured validation results for expected domain issues where the domain API supports them. Throw for failures the caller cannot reasonably continue through.
- Catch errors where they can be recovered from, translated into UI feedback or given useful operational context. Do not catch and silently continue with corrupt state.
- Keep the previous valid state when an edit fails. Never show success before the required write succeeds.
- Use stable error codes or structured data across library boundaries. Localised UI wording belongs to the consuming application.
- Log unexpected failures at an appropriate boundary; avoid repeated logging of the same error at every layer.
- Do not log secrets, entire imported documents or personal data as debugging context.
- Avoid fabricated fallback values that hide a broken invariant. An explicit missing state is better than a plausible but incorrect object.

## 11. UI and accessibility

These requirements apply to UI packages; leave them out of a pure domain library's runtime dependencies.

- Use native semantic elements before adding ARIA. Use buttons for actions, anchors for navigation and labels for inputs.
- Support keyboard operation, visible focus and predictable focus restoration. Tooltips supplement an accessible name; they do not replace it.
- Keep headings, groups, lists and validation relationships meaningful to assistive technology.
- Support long names, translated text, small viewports and zoom. Truncation must not make an action or value inaccessible.
- Respect reduced motion and clean up animation resources. Avoid animations that prevent interaction or obscure state changes.
- Share spacing, colours, typography and interaction states through the design system rather than copying values into each feature.
- Keep implementation details out of product text. Translate user-facing strings through the application's language system.

Semantic structure follows the [W3C WAI page-structure guidance](https://www.w3.org/WAI/tutorials/page-structure/); the specific component APIs belong to the chosen design system.

## 12. Libraries and public APIs

- Define the supported runtimes, module formats, TypeScript range and public entry points before publishing.
- Export only supported contracts. An exported helper becomes a compatibility commitment; do not export internals for convenience.
- Use package `exports` and matching type declarations to define entry points. Test consumers through those entry points, rather than only through source paths.
- Choose module resolution and emitted extensions for the runtime. Do not copy an Angular bundler configuration into a Node library without checking its output.
- Keep a pure domain package independent of Angular, the DOM, Electron and browser storage. Put runtime implementations behind narrow adapters.
- Keep runtime dependencies minimal. Use peer dependencies when the consumer must provide the same framework instance; do not move required runtime code into dev dependencies.
- Avoid import-time I/O and mutable singletons in general-purpose packages. Make environment dependencies explicit.
- Document normal usage, input constraints, mutation, errors and asynchronous behaviour. Include a minimal working example for a new public capability.
- Check the packaged artifact: JavaScript, declarations, exports, licence and required assets. Verify installation in a clean consumer using the supported runtime.
- Changes to types, defaults, errors and ordering can break consumers even when a function name stays the same. Review them as API changes.
- Use semantic versioning for a declared stable API. During `0.x`, state the compatibility policy explicitly; the version alone should not be a promise of stability.
- Deprecate deliberately and provide a migration path when practical. Avoid publishing a renamed API without explaining the replacement.

Entry-point rules build on [Node's package documentation](https://nodejs.org/api/packages.html#package-entry-points); compatibility policy follows [Semantic Versioning](https://semver.org/).

## 13. Tests and verification

- Test observable behaviour and invariants, rather than reproducing private implementation steps.
- Cover normal input, empty/missing data, invalid input and the relevant failure or cancellation paths.
- Prioritise domain mutations, persistence, migrations, concurrency, undo/redo and public library contracts.
- Keep pure-function tests deterministic. Control clocks and randomness when their output matters.
- Use integration tests at real boundaries; use mocks for dependencies the test does not intend to exercise.
- For UI interactions, verify keyboard behaviour and focus as well as mouse behaviour. For a simple reversible spacing change, a focused visual check may be sufficient.
- Run formatting, lint, strict type checking and the production build. Passing these checks does not prove runtime behaviour.
- A library release also needs a packaged-consumer check. Keep test commands and required gates documented in that repository.
- Fix the concrete risk before broadening the test suite. Avoid redundant tests that assert the implementation against itself.

## 14. Security, dependencies and performance

- Validate untrusted inputs at their boundary. Apply allowlists to external protocols and privileged operations.
- Keep secrets out of source, fixtures, logs and distributable frontend code.
- Keep renderer and privileged runtime responsibilities separate. IPC requires narrow capabilities and validated callers and payloads.
- Review dependencies for necessity, licence, maintenance and runtime cost. Commit the lockfile and keep supported tool versions consistent between local work and CI.
- Do not weaken compiler or lint checks to accommodate an unclear design. Document a narrowly justified exception instead.
- Prefer clear algorithms and appropriate data structures. Measure performance problems before adding caches or complex optimisations.
- Bound expensive work and large collections where input can grow. Account for invalidation before caching derived values.

Desktop-specific details must follow the current [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security).

## 15. Comments and documentation

- Prefer clear names and small APIs over comments describing each statement.
- Write a short responsibility comment for a service or lifecycle owner when it helps a new developer locate the right extension point.
- Explain non-obvious reasons, invariants, compatibility constraints and workarounds. Include an issue reference for a temporary workaround when available.
- Use TSDoc/JSDoc for public library contracts where the signature alone cannot explain behaviour. Do not repeat every obvious parameter name in prose.
- Keep architecture and extension instructions in Markdown. Update examples when the API changes.
- Remove dead code and obsolete comments. Do not retain commented-out implementations as history.
- A TODO must describe actionable work and context; it must not replace handling a current correctness problem.

## 16. Changes and commits

- Keep a change focused and reviewable. Separate broad formatting or naming migrations from behavioural changes.
- Preserve unrelated local work. Do not expand a cleanup into a new architecture without a concrete need.
- Use `type(scope): description` under the repository's Conventional Commits configuration. State what changed; describe breaking changes explicitly.
- Run the configured commit-message validation. A valid commit message does not replace code verification.
- Record material limitations honestly: checks not run, incomplete runtime coverage and unresolved build or CI prerequisites.

Commit structure follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/); allowed scopes and types remain project decisions.

## 17. Review checklist

- [ ] The responsibility and owner of each change are clear.
- [ ] Names distinguish identities, positions, units and states.
- [ ] Public signatures are explicit; boundary data is validated.
- [ ] Mutation, persistence and error behaviour are deliberate.
- [ ] Async operations cannot apply stale results to another context.
- [ ] Resources and cancellations have an owner.
- [ ] UI semantics, keyboard use and long text are considered where relevant.
- [ ] New exports are intentional and compatible with supported consumers.
- [ ] Tests cover the actual regression risk; required checks passed.
- [ ] Documentation, translations and tooling remain consistent.

## 18. Adopting this in another repository

1. Copy this baseline and record the project's deliberate deviations.
2. Add a short supplement for its architecture, runtime, framework, domain terms and extension points.
3. Configure the formatter, strict compiler and lint rules to enforce the mechanical decisions.
4. Define public entry points and supported consumer environments for libraries.
5. Add verification commands and CI gates; do not document a gate as enforced before it exists.
6. Migrate existing files in coherent changes. New code follows the adopted rules immediately.

## Technical references

- [TypeScript strict checking](https://www.typescriptlang.org/tsconfig/strict.html) and [everyday types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html) underpin the type-safety rules.
- [Angular style guide](https://angular.dev/style-guide) and [signals guidance](https://angular.dev/guide/signals) inform the framework supplement, not the runtime contract of a plain TypeScript library.
- W3C, Node, Electron, Semantic Versioning and Conventional Commits references appear beside their relevant rules above.

The naming, annotation and formatting choices are the adopted author style. The references support technical constraints; they do not prescribe every preference in this document.
