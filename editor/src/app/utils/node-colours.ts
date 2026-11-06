import { ModelRef, type Model, type Node } from '@ramen-suite/core/model';
import { RAMEN_ELEMENT } from '@ramen-suite/core/ramen';
import { type NodeColours } from '../models/ModelRecord';

const PASTEL_PALETTE: readonly string[] = [
  '#d6ecd4',
  '#dcb7ce',
  '#8ed4c6',
  '#aec9a0',
  '#b2c0e3',
  '#debca0',
  '#91cddd',
  '#b5beae',
];
const RAMEN_COLOURS: NodeColours = {
  [RAMEN_ELEMENT.ENTITY]: '#fc9c99',
  [RAMEN_ELEMENT.CONTENT]: '#97b887',
  [RAMEN_ELEMENT.ANNOTATION]: '#e4a175',
  [RAMEN_ELEMENT.COLLECTION]: '#6ebef5',
};

export function getDefaultNodeColours(models: readonly Model[]): NodeColours {
  const nodes: Map<string, Node> = new Map();
  for (const model of models) {
    for (const node of model.classifiers) {
      if (node.kind === 'Node') nodes.set(node.id, node);
    }
  }
  return Object.fromEntries([...nodes.values()].map((node: Node): [string, string] => [node.id, getNodeColour(node, nodes)]));
}

function getNodeColour(node: Node, nodes: ReadonlyMap<string, Node>): string {
  let current: Node | undefined = node;
  const visited: Set<string> = new Set();
  while (current && !visited.has(current.id)) {
    const colour: string | undefined = RAMEN_COLOURS[current.id];
    if (colour) return colour;
    visited.add(current.id);
    current = nodes.get(ModelRef.localId(current.superTypes[0] ?? ''));
  }

  let hash: number = 0;
  for (const letter of node.id) hash = (hash * 31 + letter.charCodeAt(0)) >>> 0;
  const index: number = ((hash ^ (hash >>> 16)) >>> 0) % PASTEL_PALETTE.length;
  return PASTEL_PALETTE[index] ?? '#789cc2';
}
