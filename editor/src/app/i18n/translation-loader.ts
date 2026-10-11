import { Injectable } from '@angular/core';
import { type Translation, type TranslocoLoader } from '@jsverse/transloco';
import { type Observable, of } from 'rxjs';
import english from './en.json';
import german from './de.json';

/** Bundled translations also work offline with Electron's file URLs. */
@Injectable({ providedIn: 'root' })
export class TranslationLoader implements TranslocoLoader {
  public getTranslation(language: string): Observable<Translation> {
    return of(language === 'de' ? german : english);
  }
}
