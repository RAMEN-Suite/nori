import { type Attribute, type Node } from '@ramen-suite/core/model';

export interface NodeDefinition {
  readonly modelId: string;
  readonly node: Node;
}

export interface InheritedAttribute {
  readonly modelId: string;
  readonly levelIndex: number;
  readonly nodeId: string;
  readonly nodeName: string;
  readonly attribute: Attribute;
}
