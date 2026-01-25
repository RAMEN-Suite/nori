import { GDataType, GModel, GNode, GRelation, Ref } from '../models/GModel';
import { Reference } from '../validation/container/Reference';

export interface GraphNode {
  readonly id: string;
  readonly kind: 'GNode';
  readonly label: string;
  readonly superType: string;
}

export interface GraphLink {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly kind: 'GRelation';
  readonly label: string;
}

export interface GraphData {
  readonly nodes: GraphNode[];
  readonly links: GraphLink[];
}

export interface ClassifierIndex {
  readonly nodeById: Map<string, GNode>;
  readonly dataTypeById: Map<string, GDataType>;
}

export class GModelGraph {
  public build(model: GModel | null): GraphData {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    if (!model) return { nodes, links };

    const existingNodeIds: Set<string> = new Set<string>();
    const index: ClassifierIndex = this.indexClassifiers(model);

    this.appendNodeNodes(index, nodes, existingNodeIds);
    this.appendRelationLinks(model, links);

    return { nodes, links };
  }

  private indexClassifiers(model: GModel): ClassifierIndex {
    const nodeById: Map<string, GNode> = new Map<string, GNode>();
    const dataTypeById: Map<string, GDataType> = new Map<string, GDataType>();

    for (const classifier of model.classifiers) {
      if (classifier.kind === 'GNode') nodeById.set(classifier.id, classifier);
      if (classifier.kind === 'GDataType') dataTypeById.set(classifier.id, classifier);
    }

    return { nodeById, dataTypeById };
  }

  private appendNodeNodes(index: ClassifierIndex, nodes: GraphNode[], existingNodeIds: Set<string>): void {
    for (const node of index.nodeById.values()) {
      const superType: string | undefined = node.superTypes[0];
      if (!superType) continue;

      const graphNode: GraphNode = {
        id: node.id,
        kind: 'GNode',
        label: node.name,
        superType: Reference.splitQualified(superType).nodeId,
      };

      nodes.push(graphNode);
      existingNodeIds.add(graphNode.id);
    }
  }

  private appendRelationLinks(model: GModel, links: GraphLink[]): void {
    for (const relation of model.relations) {
      const fromRef: Ref = relation.from.nodeId;
      const toRef: Ref = relation.to.nodeId;

      const link: GraphLink = {
        id: relation.id,
        source: fromRef,
        target: toRef,
        kind: 'GRelation',
        label: this.formatRelationLabel(relation),
      };

      links.push(link);
    }
  }

  private formatRelationLabel(relation: GRelation): string {
    const roles: string = `${relation.from.role} → ${relation.to.role}`;
    return `${relation.name} (${roles})`;
  }
}
