import { Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { Model } from '../models/Model';
import ramen from '../data/schema/metamodels/ramen.gcore.json';
import { SchemaValidator } from '../utils/SchemaValidator';
import { GModel } from '../models/GModel';

@Injectable({
  providedIn: 'root',
})
export class MetamodelService {
  private readonly _metamodels: WritableSignal<Model[]> = signal([]);
  public readonly metamodels: Signal<Model[]> = this._metamodels.asReadonly();

  constructor() {
    SchemaValidator.assertValid(ramen);
    this.add(ramen);
  }

  public isExisting(model: GModel): boolean {
    return !!this.metamodels().find((m: Model): boolean => {
      const isSameModel: boolean = model.id === m.id;
      const isSameVersion: boolean = model.version === m.version;
      return isSameModel && isSameVersion;
    });
  }

  public add(model: GModel): void {
    if (this.isExisting(model)) return;

    const metamodel: Model = {
      id: model.id,
      version: model.version,
      name: model.name,
      serialisation: model,
    };

    this._metamodels.update((metamodels: Model[]): Model[] => [...metamodels, metamodel]);
  }
}
