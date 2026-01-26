import { Diagnostic } from '../container/Diagnostics';

export abstract class AbstractRules {
  public abstract validate(...args: unknown[]): Diagnostic[];
}
