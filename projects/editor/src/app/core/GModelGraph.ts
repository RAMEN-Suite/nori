import { GDataType, GModel, GNode, GRelation, Ref } from '../models/GModel';
import { Refs } from './validation/container/References';

export type GraphNodeKind = 'GNode' | 'GDataType' | 'Unknown';
export type GraphLinkKind = 'GRelation' | 'SuperType';

export interface GraphNode {
  readonly id: string;
  readonly refId: string;
  readonly kind: GraphNodeKind;
  readonly label: string;
}

export interface GraphLink {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly kind: GraphLinkKind;
  readonly label: string;
  readonly refId: string;
}

export interface GraphData {
  readonly nodes: GraphNode[];
  readonly links: GraphLink[];
}

export interface GraphOptions {
  readonly includeDataTypes: boolean;
  readonly includeSupertypes: boolean;
  readonly includeUnknownRefs: boolean;
  readonly relationLabelMode: 'name' | 'roles' | 'both';
}

export interface ClassifierIndex {
  readonly nodeById: Map<string, GNode>;
  readonly dataTypeById: Map<string, GDataType>;
}

export class GModelGraph {
  public build(model: GModel, options?: Partial<GraphOptions>): GraphData {
    const graphOptions: GraphOptions = this.createOptions(options);

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    const existingNodeIds: Set<string> = new Set<string>();
    const index: ClassifierIndex = this.indexClassifiers(model);

    this.appendNodeNodes(index, nodes, existingNodeIds);
    this.appendDataTypeNodes(index, nodes, existingNodeIds, graphOptions);

    this.appendRelationLinks(model, index, nodes, existingNodeIds, links, graphOptions);
    this.appendSuperTypeLinks(index, nodes, existingNodeIds, links, graphOptions);

    return { nodes, links };
  }

  private createOptions(options?: Partial<GraphOptions>): GraphOptions {
    return {
      includeDataTypes: true,
      includeSupertypes: true,
      includeUnknownRefs: true,
      relationLabelMode: 'both',
      ...options,
    };
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

  private appendNodeNodes(
    index: ClassifierIndex,
    nodes: GraphNode[],
    existingNodeIds: Set<string>,
  ): void {
    for (const node of index.nodeById.values()) {
      const graphNode: GraphNode = {
        id: this.createGraphId('node', node.id),
        refId: node.id,
        kind: 'GNode',
        label: node.name,
      };

      nodes.push(graphNode);
      existingNodeIds.add(graphNode.id);
    }
  }

  private appendDataTypeNodes(
    index: ClassifierIndex,
    nodes: GraphNode[],
    existingNodeIds: Set<string>,
    options: GraphOptions,
  ): void {
    if (!options.includeDataTypes) return;

    for (const dataType of index.dataTypeById.values()) {
      const graphNode: GraphNode = {
        id: this.createGraphId('dataType', dataType.id),
        refId: dataType.id,
        kind: 'GDataType',
        label: dataType.name,
      };

      nodes.push(graphNode);
      existingNodeIds.add(graphNode.id);
    }
  }

  private appendRelationLinks(
    model: GModel,
    index: ClassifierIndex,
    nodes: GraphNode[],
    existingNodeIds: Set<string>,
    links: GraphLink[],
    options: GraphOptions,
  ): void {
    for (const relation of model.relations) {
      const fromRef: Ref = relation.from.nodeId;
      const toRef: Ref = relation.to.nodeId;

      if (options.includeUnknownRefs) {
        this.ensureGraphNodeForRefExists(fromRef, index, nodes, existingNodeIds);
        this.ensureGraphNodeForRefExists(toRef, index, nodes, existingNodeIds);
      }

      const link: GraphLink = {
        id: this.createGraphId('relation', relation.id),
        source: this.createGraphId('node', String(fromRef)),
        target: this.createGraphId('node', String(toRef)),
        kind: 'GRelation',
        label: this.formatRelationLabel(relation, options.relationLabelMode),
        refId: relation.id,
      };

      links.push(link);
    }
  }

  private appendSuperTypeLinks(
    index: ClassifierIndex,
    nodes: GraphNode[],
    existingNodeIds: Set<string>,
    links: GraphLink[],
    options: GraphOptions,
  ): void {
    if (!options.includeSupertypes) return;

    for (const node of index.nodeById.values()) {
      const superTypes: Ref[] = node.superTypes ?? [];

      for (let superTypeIndex: number = 0; superTypeIndex < superTypes.length; superTypeIndex++) {
        const superTypeRef: Ref = superTypes[superTypeIndex];

        if (options.includeUnknownRefs) {
          this.ensureGraphNodeForRefExists(superTypeRef, index, nodes, existingNodeIds);
        }

        const link: GraphLink = {
          id: `${this.createGraphId('node', node.id)}::superType::${superTypeIndex}`,
          source: this.createGraphId('node', node.id),
          target: this.createGraphId('node', String(superTypeRef)),
          kind: 'SuperType',
          label: 'extends',
          refId: String(superTypeRef),
        };

        links.push(link);
      }
    }
  }

  private formatRelationLabel(
    relation: GRelation,
    mode: GraphOptions['relationLabelMode'],
  ): string {
    const roles: string = `${relation.from.role} → ${relation.to.role}`;

    if (mode === 'name') return relation.name;
    if (mode === 'roles') return roles;
    return `${relation.name} (${roles})`;
  }

  private createGraphId(kind: 'node' | 'dataType' | 'relation', identifier: string): string {
    return `${kind}:${identifier}`;
  }

  private ensureGraphNodeForRefExists(
    ref: Ref,
    index: ClassifierIndex,
    nodes: GraphNode[],
    existingNodeIds: Set<string>,
  ): void {
    const refString: string = String(ref);

    if (!Refs.isQualified(refString) && index.nodeById.has(refString)) return;
    const graphNodeId: string = this.createGraphId('node', refString);
    if (existingNodeIds.has(graphNodeId)) return;

    const placeholderNode: GraphNode = {
      id: graphNodeId,
      refId: refString,
      kind: 'Unknown',
      label: Refs.isQualified(refString) ? refString : `?${refString}`,
    };

    nodes.push(placeholderNode);
    existingNodeIds.add(placeholderNode.id);
  }
}
