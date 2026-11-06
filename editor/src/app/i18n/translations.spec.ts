import { expect, it } from 'vitest';
import de from './de.json';
import en from './en.json';
import itTranslations from './it.json';

function flatten(value: object, prefix: string = ''): Map<string, string> {
  const strings: Map<string, string> = new Map();
  const entries: [string, unknown][] = Object.entries(value);
  for (const [key, child] of entries) {
    const path: string = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') strings.set(path, child);
    else if (child && typeof child === 'object') {
      for (const [nested, text] of flatten(child, path)) strings.set(nested, text);
    }
  }
  return strings;
}

function placeholders(text: string): string[] {
  return [...new Set(Array.from(text.matchAll(/\{\{\s*\w+\s*\}\}/g), (match): string => match[0].slice(2, -2).trim()))].sort();
}

it.each([
  ['German', de],
  ['Italian', itTranslations],
] as const)('keeps %s keys and placeholders aligned with English', (_language, dictionary): void => {
  const reference: Map<string, string> = flatten(en);
  const translations: Map<string, string> = flatten(dictionary);
  expect([...translations.keys()].sort()).toEqual([...reference.keys()].sort());
  for (const [key, text] of reference) {
    expect(placeholders(translations.get(key) ?? ''), key).toEqual(placeholders(text));
  }
});
