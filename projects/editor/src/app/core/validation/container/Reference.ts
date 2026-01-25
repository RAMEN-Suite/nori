import { REGEXP } from '../../const/REGEXP';
import { Id, QualifiedRef, Ref } from '../../models/GModel';

export interface QualifiedParts {
  readonly modelId: Id;
  readonly nodeId: Id;
}

export class Reference {
  public static isQualified(ref: Ref): ref is QualifiedRef {
    return REGEXP.QUALIFIED_REF.test(ref);
  }

  public static splitQualified(ref: QualifiedRef): QualifiedParts {
    if (!Reference.isQualified(ref)) {
      throw new Error(`Invalid QualifiedRef: '${ref}'`);
    }

    const index: number = ref.indexOf(':');
    return { modelId: ref.slice(0, index), nodeId: ref.slice(index + 1) };
  }

  public static qualify(baseId: Id, nodeId: Id): QualifiedRef {
    return `${baseId}:${nodeId}`;
  }
}
