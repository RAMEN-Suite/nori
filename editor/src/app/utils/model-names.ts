const NAME_START: RegExp = /(?:^|[^\p{L}\p{N}_]+)(\p{L})/gu;
const NAME_INVALID_CHARS: RegExp = /[^\p{L}\p{N}_]/gu;
const NAME_VALID_START: RegExp = /^\p{L}/u;

export function toPascalName(value: string): string {
  const pascalized: string = value
    .replace(NAME_START, (_: string, letter: string): string => letter.toUpperCase())
    .replace(NAME_INVALID_CHARS, '')
    .slice(0, 40);

  return NAME_VALID_START.test(pascalized) ? pascalized : `N${pascalized}`;
}

export function toCamelName(value: string): string {
  const pascalized: string = value
    .replace(NAME_START, (_: string, letter: string): string => letter.toUpperCase())
    .replace(NAME_INVALID_CHARS, '')
    .slice(0, 32);

  const camelized: string = pascalized.charAt(0).toLowerCase() + pascalized.slice(1);
  return NAME_VALID_START.test(camelized) ? camelized : `p${camelized}`;
}
