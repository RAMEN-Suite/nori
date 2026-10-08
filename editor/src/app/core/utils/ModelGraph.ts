import { ModelRef, type Model, type Node, type Relation } from '@ramen-suite/core/model';

export interface GraphNode {
  readonly id: string;
  readonly kind: 'Node';
  readonly label: string;
  readonly superType: string;
}

export interface GraphLink {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly kind: 'Relation';
  readonly label: string;
}

export interface GraphData {
  readonly nodes: GraphNode[];
  readonly links: GraphLink[];
}

/** Projects local nodes and referenced imported nodes for display. Core owns their semantics. */
export class ModelGraph {
  public build(model: Model | null, models: readonly Model[] = []): GraphData {
    if (!model) return { nodes: [], links: [] };

    const nodes: Map<string, GraphNode> = new Map();
    const definitions: Map<string, Model> = new Map(models.map((item: Model): [string, Model] => [item.id, item]));
    for (const item of model.classifiers) {
      if (item.kind === 'Node') nodes.set(item.id, this.projectNode(item, item.id));
    }
    for (const relation of model.relations) {
      for (const ref of [relation.from.nodeId, relation.to.nodeId]) {
        if (nodes.has(ref) || !ModelRef.isQualified(ref)) continue;
        const { modelId, refId } = ModelRef.splitQualified(ref);
        const node: Node | undefined = definitions
          .get(modelId)
          ?.classifiers.find((item): item is Node => item.kind === 'Node' && item.id === refId);
        if (node) nodes.set(ref, this.projectNode(node, ref));
      }
    }

    const links: GraphLink[] = model.relations.map(
      (relation: Relation): GraphLink => ({
        id: relation.id,
        source: relation.from.nodeId,
        target: relation.to.nodeId,
        kind: 'Relation',
        label: relation.name,
      }),
    );
    return { nodes: [...nodes.values()], links };
  }

  private projectNode(node: Node, id: string): GraphNode {
    return { id, kind: 'Node', label: node.name, superType: ModelRef.localId(node.superTypes[0] ?? node.id) };
  }
}
