import { Injectable } from '@angular/core';
import { Nullable } from '../../global';

@Injectable({
  providedIn: 'root',
})
export class LocalStorage {
  public getItems<T>(key: string): Nullable<T> {
    try {
      const contents: Nullable<string> = localStorage.getItem(key);
      if (contents === undefined || contents === null) return null;
      return JSON.parse(contents);
    } catch (error: unknown) {
      console.error('Parsing items in LocalStorage failed.');
      return null;
    }
  }

  public setItems<T>(key: string, items: T[] | T): void {
    if (items === undefined) return;
    const contents: string = JSON.stringify(items);
    localStorage.setItem(key, contents);
  }

  public removeItems(key: string): void {
    localStorage.removeItem(key);
  }
}
