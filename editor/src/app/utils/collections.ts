export function indexBy<T, K>(items: readonly T[], key: (item: T) => K): ReadonlyMap<K, T> {
  return new Map(items.map((item: T): [K, T] => [key(item), item]));
}
