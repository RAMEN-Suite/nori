import { REGEXP } from '../../const/REGEXP';
import { BuiltinType, Id, QualifiedRef, Ref, TypeRef } from '../../models/GModel';

export interface QualifiedRefParts {
  readonly modelId: Id;
  readonly nodeId: Id;
}

export class Builtins {
  public static readonly set: ReadonlySet<string> = new Set([
    'string',
    'boolean',
    'number',
    'integer',
  ]);

  public static isBuiltin(ref: TypeRef): ref is BuiltinType {
    return Builtins.set.has(ref);
  }
}

export class Refs {
  public static isQualified(ref: Ref): ref is QualifiedRef {
    return REGEXP.isQualifiedRef.test(ref);
  }

  public static splitQualified(ref: QualifiedRef): QualifiedRefParts {
    if (!Refs.isQualified(ref)) {
      throw new Error(`Invalid QualifiedRef: '${ref}'`);
    }

    const index: number = ref.indexOf(':');
    return { modelId: ref.slice(0, index), nodeId: ref.slice(index + 1) };
  }

  public static qualify(baseId: Id, nodeId: Id): QualifiedRef {
    return `${baseId}:${nodeId}`;
  }
}
