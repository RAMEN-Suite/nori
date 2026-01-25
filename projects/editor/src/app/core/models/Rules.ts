import { Diagnostic } from '../validation/container/Diagnostics';

export interface Rules {
  validate(...args: unknown[]): Diagnostic[];
}
