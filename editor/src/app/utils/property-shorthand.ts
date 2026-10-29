import type { Bounds, DataTypeSuggestion } from '@ramen-suite/core/model';

export type PropertyShorthand =
  | { readonly kind: 'valid'; readonly name: string; readonly typeId: string | null; readonly bounds: Bounds | null }
  | { readonly kind: 'invalid'; readonly reason: 'format' | 'bounds' }
  | { readonly kind: 'unknownType'; readonly type: string };

const SHORTHAND: RegExp = /^\s*([^:[\]]+?)\s*(?::\s*([^:[\]]+?))?\s*(?:\[\s*(\d+)\s*(?:\.\.\s*(\d+|\*))?\s*\])?\s*$/u;

/** Parses `name`, `name: Type` or `name: Type[min..max]`; `*` marks an unlimited maximum. */
export function parsePropertyShorthand(text: string, types: readonly DataTypeSuggestion[]): PropertyShorthand {
  const match: RegExpExecArray | null = SHORTHAND.exec(text);
  const name: string | undefined = match?.[1];
  if (!match || !name) return { kind: 'invalid', reason: 'format' };

  const typeName: string | undefined = match[2];
  const type: DataTypeSuggestion | undefined = findType(typeName, types);
  if (typeName && !type) return { kind: 'unknownType', type: typeName };

  const bounds: Bounds | null = parseBounds(match[3], match[4]);
  if (bounds && (bounds.upperBound === 0 || (bounds.upperBound !== -1 && bounds.upperBound < bounds.lowerBound)))
    return { kind: 'invalid', reason: 'bounds' };
  return { kind: 'valid', name, typeId: type?.ref ?? null, bounds };
}

function findType(name: string | undefined, types: readonly DataTypeSuggestion[]): DataTypeSuggestion | undefined {
  if (!name) return undefined;
  return types.find((item: DataTypeSuggestion): boolean => item.name.toLowerCase() === name.toLowerCase());
}

function parseBounds(lower: string | undefined, upper: string | undefined): Bounds | null {
  if (lower === undefined) return null;
  const lowerBound: number = Number(lower);
  if (upper === undefined) return { lowerBound, upperBound: lowerBound };
  return { lowerBound, upperBound: upper === '*' ? -1 : Number(upper) };
}
