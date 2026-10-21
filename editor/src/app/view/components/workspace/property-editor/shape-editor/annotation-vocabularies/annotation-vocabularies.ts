import { DataTypes, type AttributeInput } from '@ramen-suite/core/model';

export interface AnnotationPreset {
  readonly type: string;
  readonly properties?: readonly AttributeInput[];
}

export interface AnnotationVocabulary {
  readonly id: string;
  readonly nameKey: string;
  readonly hintKey: string;
  readonly annotations: readonly AnnotationPreset[];
}

export const ANNOTATION_VOCABULARIES: readonly AnnotationVocabulary[] = [
  {
    id: 'text-editor',
    nameKey: 'editor.shapes.vocabularies.textEditor',
    hintKey: 'editor.shapes.vocabularies.textEditorHint',
    annotations: [
      { type: 'p' },
      { type: 'head', properties: [{ name: 'level', typeId: DataTypes.Integer }] },
      { type: 'lb' },
      { type: 'row' },
      {
        type: 'cell',
        properties: [
          { name: 'cols', typeId: DataTypes.Integer },
          { name: 'rows', typeId: DataTypes.Integer },
        ],
      },
      { type: 'list' },
      { type: 'item' },
    ],
  },
  {
    id: 'tei',
    nameKey: 'editor.shapes.vocabularies.tei',
    hintKey: 'editor.shapes.vocabularies.teiHint',
    annotations: [{ type: 'date' }, { type: 'persName' }, { type: 'placeName' }],
  },
];
