import { BuiltinType, TypeRef } from '../../models/GModel';

export class Builtins {
  public static readonly set: ReadonlySet<string> = new Set(['String', 'Boolean', 'Float', 'Integer']);

  public static isBuiltin(ref: TypeRef): ref is BuiltinType {
    return Builtins.set.has(ref);
  }
}
