import { HashLocationStrategy, PlatformLocation } from '@angular/common';
import { DOCUMENT, inject, Injectable } from '@angular/core';

/** Keeps the HTML entry file in desktop route URLs so native reloads can reopen it. */
@Injectable()
export class DesktopLocationStrategy extends HashLocationStrategy {
  private readonly entryUrl: string = new URL('index.html', inject(DOCUMENT).baseURI).href;

  public constructor() {
    super(inject(PlatformLocation));
  }

  public override prepareExternalUrl(internal: string): string {
    return this.entryUrl + super.prepareExternalUrl(internal);
  }
}
