export type BuiltinScalarType = 'string' | 'boolean' | 'number' | 'integer';

export interface QualifiedRefParts {
  readonly alias: string;
  readonly id: string;
}

export class Builtins {
  public static readonly set: ReadonlySet<string> = new Set([
    'string',
    'boolean',
    'number',
    'integer',
  ]);

  public static isBuiltin(ref: string): ref is BuiltinScalarType {
    return Builtins.set.has(ref);
  }
}

export class Refs {
  public static isQualified(ref: string): boolean {
    return ref.includes(':');
  }

  public static splitQualified(ref: string): QualifiedRefParts {
    const index: number = ref.indexOf(':');
    return { alias: ref.slice(0, index), id: ref.slice(index + 1) };
  }

  public static qualify(alias: string, id: string): string {
    return `${alias}:${id}`;
  }
}
