export class FieldValidationError extends Error {
  public constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = 'FieldValidationError';
  }
}
