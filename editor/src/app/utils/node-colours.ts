import { ModelRef, type Model, type Node } from '@ramen-suite/core/model';
import { RAMEN_ELEMENT } from '@ramen-suite/core/ramen';
import iwanthue from 'iwanthue';
import { type NodeColors } from '../models/ModelRecord';

const PASTEL_PALETTE: readonly string[] = iwanthue(8, { colorSpace: 'pastel', seed: 'Nori' });
const RAMEN_COLOURS: NodeColors = {
  [RAMEN_ELEMENT.ENTITY]: pastelColour(15, 35),
  [RAMEN_ELEMENT.CONTENT]: pastelColour(125, 155),
  [RAMEN_ELEMENT.ANNOTATION]: pastelColour(55, 75),
  [RAMEN_ELEMENT.COLLECTION]: pastelColour(245, 265),
};

export function getDefaultNodeColours(models: readonly Model[]): NodeColors {
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

function pastelColour(hmin: number, hmax: number): string {
  return iwanthue(1, { colorSpace: [hmin, hmax, 25, 40, 68, 78], seed: 'Nori' })[0] ?? '#789cc2';
}
