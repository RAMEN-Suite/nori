import { Injectable } from '@angular/core';
import { type Translation, type TranslocoLoader } from '@jsverse/transloco';
import { type Observable, of } from 'rxjs';
import { Languages } from './languages';

@Injectable({ providedIn: 'root' })
export class TranslationLoader implements TranslocoLoader {
  public getTranslation(language: string): Observable<Translation> {
    return of(Languages.translations[Languages.isSupported(language) ? language : Languages.defaultLanguage]);
  }
}
