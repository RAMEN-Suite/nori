# Coding conventions

Write code and technical docs in British English. Preserve existing filenames, external APIs and stored keys. Use PascalCase for types and classes, camelCase for members and predicate names for internal booleans, such as `isSaving`, `canEdit` and `hasChanges`.

## TypeScript

- Keep imports at the top in framework/runtime, external and project groups. Use public package entry points and mark type-only imports.
- Annotate fields, variables, parameters and return types. Contextually typed callback parameters and destructuring may use inference where lint permits it.
- Use `unknown` for JSON, storage and IPC input and validate it at the boundary. Avoid `any`, unchecked casts and non-null assertions.
- Use guard clauses, short functions with one responsibility and blank lines between distinct steps. Let Prettier handle formatting.

## Angular and state

- Use standalone OnPush components, `inject()`, host metadata and signal component APIs. Keep state with its owner and expose read-only signals to consumers where practical.
- Use `computed()` for derived state and `linkedSignal()` for writable state that resets with its source. Use effects for synchronisation with external systems. Update signal collections immutably.
- Keep workflow logic in services and pure calculations in helpers. Keep resource handles and D3 renderer bookkeeping in the layer that manages their lifecycle.

## Commands and persistence

- Validate changes through the normal command boundary. Reuse cached Core facades and keep history and rollback with the command.
- Serialise conflicting writes. Capture project and model identity before awaiting and verify it before applying the result. Handle promise rejections and clean up listeners, observers and timers with their owner.
- Preserve the last valid value on a rejected edit. Keep field validation local and use shared feedback for operation outcomes.

## UI

- Reuse Sushi controls and tokens, shared panel and dialog frames, and the type scale in `editor/src/styles/tailwind.css`. Keep catalogue row styling in `_editor-list.scss` and bordered surface lists in `_surface-list.scss`.
- Use semantic controls with translated labels. Icon-only buttons need accessible names. Preserve keyboard focus, reduced motion and overflow behaviour. Submit forms through the same guarded action for Enter and the primary button.
- Keep statuses transient, actions available until resolved and hints contextual. Use shared feedback components and service lifecycles.
- Update all supported translations for visible copy. Keep titles and short labels free of trailing periods. Emphasise affected names in confirmation text with semantic markup and keep accessible labels plain.

The [component map](architecture.md) identifies the owners of these patterns. Follow the [contribution guide](../CONTRIBUTING.md) for verification and commits.
