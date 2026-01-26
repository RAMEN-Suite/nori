import { Diagnostic } from '../container/Diagnostics';

export abstract class AbstractRule {
  public abstract validate(...args: unknown[]): Diagnostic[];
}
