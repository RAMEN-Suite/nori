import { REGEXP } from '../../const/REGEXP';
import { BuiltinType } from '../../models/GModel';

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

  public static isBuiltin(ref: string): ref is BuiltinType {
    return Builtins.set.has(ref);
  }
}

export class Refs {
  public static isQualified(ref: string): boolean {
    return REGEXP.isQualifiedRef.test(ref);
  }

  public static splitQualified(ref: string): QualifiedRefParts {
    if (!Refs.isQualified(ref)) {
      throw new Error(`Invalid QualifiedRef: '${ref}'`);
    }

    const index: number = ref.indexOf(':');
    return { modelId: ref.slice(0, index), nodeId: ref.slice(index + 1) };
  }

  public static qualify(baseId: string, nodeId: string): string {
    return `${baseId}:${nodeId}`;
  }
}
