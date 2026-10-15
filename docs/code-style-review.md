# Code-style review

Reviewed on 2026-10-16 against the current working tree, including existing uncommitted work. This is a conventions and maintainability review, not a complete behavioural or security audit.

## Scope and method

- Structural scan of all 186 TypeScript, template and style files under `editor/src`, `electron/src` and `tools`: 14,558 lines before this review's cleanup.
- TypeScript syntax inspection for declarations, visibility patterns, imports, assertions and component metadata; text inspection for suppression comments and style escape hatches.
- Detailed reading of representative state, query, action, persistence, editing, history, running-action, property-form, graph-helper, directive, translation and Electron boundaries.
- Review of compiler, formatter, lint, commit, build and CI configuration, plus the existing architecture documentation.
- Comparison with the official technical references linked in the [reusable baseline](typescript-conventions.md).

The structural scan covers every source file in these directories. The detailed reading is representative; it does not establish the correctness of every execution path or audit the sibling RAMEN Core and Sushi repositories.

## What the code already does consistently

| Observation                    | Evidence and resulting convention                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Explicit typing and visibility | Class members, parameters and returns are explicit; preserve this as the author style. Contextual callback inference remains allowed.                              |
| Strict types                   | No `any` syntax nodes, expression non-null assertions or lint/type suppression comments found in the scanned source. Keep boundary validation and strict checking. |
| Modern Angular                 | All 42 components use OnPush. Signals, injection and standalone imports are the established approach.                                                              |
| Clear state ownership          | Workspace store, queries and actions are separate; project state and repository persistence have different owners.                                                 |
| Short operations               | Guard clauses and small methods are reinforced by complexity and function-size limits.                                                                             |
| Domain separation              | RAMEN Core owns model rules; editing services coordinate UI operations around those rules.                                                                         |
| Async context checks           | Project/model identities, request tokens, queued saves and revision checks protect against stale work.                                                             |
| Focused helpers                | Collection and model-name helpers are plain calculations; graph layout, rendering, viewport and export have dedicated owners.                                      |
| Controlled presentation        | Sushi APIs and shared panels/scroll hints provide common interaction behaviour. No `::ng-deep` or `!important` found in scanned styles.                            |
| Purposeful comments            | Responsibility comments explain owners; methods generally communicate through names.                                                                               |

Representative extension points are `services/workspace/workspace.service.ts`, `services/workspace/model/workspace-actions.service.ts`, `services/projects/project-repository.service.ts`, `services/workspace/workflows/running-action.service.ts`, `utils/model-names.ts` and `i18n/languages.ts`, all relative to `editor/src/app`.

## Style choices worth retaining

- Explicit local annotations, including primitives, support the preferred reading style. They are a consistency decision rather than an objective advantage in every codebase.
- Role suffixes and feature grouping make navigation predictable. Existing PascalCase contract and Electron files do not justify a mass rename.
- Plain functions, cohesive static namespaces and lifecycle classes coexist. Select by responsibility instead of enforcing one form universally.
- Blank lines and meaningful names replace decorative section comments. Keep short responsibility comments and explanations of genuine invariants.
- Preserve the separation of model identity, record identity, level position and qualified references in every new API.

## Small corrections made

1. Removed the repeated `Select` entry from `PropertyFormComponent`'s Angular imports. The component's behaviour is unchanged.
2. Changed CI's Node selection from a separate version 24 value to `.nvmrc`, matching the repository's existing Node 26 requirement.
3. Added the reusable conventions and expanded the Nori supplement; linked both from the README.

Existing uncommitted feature changes were retained. No broad formatting migration or architecture rewrite was performed.

## Remaining gaps and priorities

### Behavioural verification

There is no automated scenario-test command or test suite in the scanned application source. Lint, typing and compilation do not cover model-operation behaviour. Prioritise tests for invalid renames, key conflicts, queued property edits, stale async context, removal review, undo/redo and persistence migrations when adding the testing setup.

### CI reproducibility

The Node version is now shared with local development. CI still needs an explicit way to obtain the built sibling `../ramen-core`, and formatting currently has `continue-on-error: true`. Decide the Core dependency strategy before treating a clean remote run as equivalent to the documented local gate. No remote workflow was executed during this review.

### Large workflow owners

The graph component remains the largest orchestration owner, with renderer, geometry, viewport, layout and export already extracted. Property editing also contains meaningful save/validation sequencing. Further extraction should isolate a coherent behaviour with a small contract, not distribute the same state across more files merely to reduce line counts.

### Published libraries

Nori is an application. Export maps, declaration compatibility, supported runtime matrices, packaged-consumer tests and an explicit release compatibility policy need separate implementation in any library adopting these conventions. They are documented in the baseline without claiming this repository already supplies them.

## Verification record

Lint, formatting, strict type checks and the Electron build passed before the cleanup. The production editor build initially aborted inside the sandbox without an Angular diagnostic and then succeeded outside the sandbox with two build workers.

The successful editor build reported style-budget warnings for the property editor and graph, CommonJS dependency warnings, and a bare import in the sibling Core output whose package declares `sideEffects: false`. These remain review items; the warnings do not establish a runtime defect, and this conventions cleanup does not change the sibling package or dependency choices.

After the documentation and cleanup changes, `NG_BUILD_MAX_WORKERS=2 npm run verify` passed outside the sandbox: editor/tooling lint, repository formatting, all three TypeScript checks, Electron build and production editor build. `git diff --check` also passed. The build warnings listed above remain. No remote CI or interactive UI check was run for this documentation and metadata cleanup.
