export type BuiltinScalarType = 'string' | 'boolean' | 'number' | 'integer';

export interface QualifiedRefParts {
  readonly modelId: string;
  readonly nodeId: string;
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
    return { modelId: ref.slice(0, index), nodeId: ref.slice(index + 1) };
  }

  public static qualify(baseId: string, nodeId: string): string {
    return `${baseId}:${nodeId}`;
  }
}
