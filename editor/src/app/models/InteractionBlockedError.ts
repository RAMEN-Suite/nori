/** A rejected command, not a failed model edit. Action-owned conflicts are explained by their action window. */
export class InteractionBlockedError extends Error {
  public constructor(
    message: string,
    public readonly explainedByAction: boolean,
  ) {
    super(message);
    this.name = 'InteractionBlockedError';
  }
}
