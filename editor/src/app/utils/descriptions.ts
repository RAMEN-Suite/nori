import { DESCRIPTION_MAX_LENGTH } from '@ramen-suite/core/model';

export function descriptionLength(value: string): number {
  return Array.from(value).length;
}

export function isDescriptionValid(value: string): boolean {
  return descriptionLength(value) <= DESCRIPTION_MAX_LENGTH;
}

export function descriptionValue(value: string): string {
  return value.trim() ? value : '';
}
