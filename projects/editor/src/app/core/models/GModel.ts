export type GClassifier = GNode | GDataType;
export type Id = string;
export type Ref = Id | QualifiedRef;
export type QualifiedRef = string;
export type ConstraintLanguage = string;
export type ConstraintSeverity = 'error' | 'warn' | 'info';
export type BuiltinType = 'string' | 'boolean' | 'number' | 'integer';
export type TypeRef = BuiltinType | Ref;

export interface GModel {
  $schema: string;
  $id: string;
  id: Id;
  version: string;
  kind: 'GModel';
  name: string;
  imports: Import[];
  classifiers: GClassifier[];
  relations: GRelation[];
  ext?: Record<string, unknown>;
}

export interface Import {
  schemaId: string;
  modelId: Id;
}

export interface GNode {
  kind: 'GNode';
  id: Id;
  name: string;
  superTypes: Ref[];
  attributes: GAttribute[];
  constraints?: GConstraint[];
  ext?: Record<string, unknown>;
}

export interface GAttribute {
  name: string;
  typeId: TypeRef;
  bounds: Bounds;
  defaultValue?: unknown;
  isKey?: boolean;
  isDerived?: boolean;
  constraints?: GConstraint[];
  ext?: Record<string, unknown>;
}

export interface Bounds {
  lowerBound: number;
  upperBound: number;
}

export interface GConstraint {
  id: Id;
  name: string;
  language: ConstraintLanguage;
  expression: string | Record<string, unknown>;
  params?: Record<string, unknown>;
  severity?: ConstraintSeverity;
  message?: string;
  code?: string;
  tags?: string[];
  ext?: Record<string, unknown>;
}

export interface GDataType {
  kind: 'GDataType';
  id: Id;
  name: string;
  literals?: [GLiteral, ...GLiteral[]];
  constraints?: GConstraint[];
  ext?: Record<string, unknown>;
}

export interface GLiteral {
  name: string;
  value?: number;
  literal?: string;
  constraints?: GConstraint[];
  ext?: Record<string, unknown>;
}

export interface GRelation {
  kind: 'GRelation';
  id: Id;
  superTypes: Ref[];
  name: string;
  from: RelationEnd;
  to: RelationEnd;
  isBidirectional?: boolean;
  constraints?: GConstraint[];
  ext?: Record<string, unknown>;
}

export interface RelationEnd {
  nodeId: Ref;
  role: string;
  bounds: Bounds;
  constraints?: GConstraint[];
  ext?: Record<string, unknown>;
}
