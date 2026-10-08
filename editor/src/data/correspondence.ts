import { type Model, type Node } from '@ramen-suite/core/model';
import { RAMEN_ELEMENT, RamenModel } from '@ramen-suite/core/ramen';

/** Creates a fresh correspondence example for a new project. */
export function createCorrespondenceModel(): Model {
  const edition: RamenModel = RamenModel.create('Correspondence');
  const letter: Node = edition.createNode({ name: 'Letter', refines: RAMEN_ELEMENT.COLLECTION }).element;
  const text: Node = edition.createNode({ name: 'Text', refines: RAMEN_ELEMENT.CONTENT }).element;
  const person: Node = edition.createNode({ name: 'Person', refines: RAMEN_ELEMENT.ENTITY }).element;
  const place: Node = edition.createNode({ name: 'Place', refines: RAMEN_ELEMENT.ENTITY }).element;

  edition.partOf(text, letter);
  edition.hasAnnotation(text, RAMEN_ELEMENT.ANNOTATION);
  edition.refersTo(RAMEN_ELEMENT.ANNOTATION, person);
  edition.refersTo(RAMEN_ELEMENT.ANNOTATION, place);

  return edition.getModel();
}
