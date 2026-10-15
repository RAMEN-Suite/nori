export function indexBy<T, K>(items: readonly T[], key: (item: T) => K): ReadonlyMap<K, T> {
  return new Map(items.map((item: T): [K, T] => [key(item), item]));
}

export function groupBy<T, K>(items: readonly T[], key: (item: T) => K): ReadonlyMap<K, readonly T[]> {
  const groups: Map<K, T[]> = new Map();
  for (const item of items) {
    const groupKey: K = key(item);
    const group: T[] = groups.get(groupKey) ?? [];
    group.push(item);
    groups.set(groupKey, group);
  }

  return groups;
}
