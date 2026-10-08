import { Directive, input, type InputSignal } from '@angular/core';

/** Keep native browser links while opening desktop links in the system browser. */
@Directive({
  selector: 'a[appExternalLink]',
  host: {
    '[href]': 'url()',
    target: '_blank',
    rel: 'noopener noreferrer',
    '(click)': 'handleClick($event)',
  },
})
export class ExternalLinkDirective {
  public readonly url: InputSignal<string> = input.required<string>({ alias: 'appExternalLink' });

  protected handleClick(event: MouseEvent): void {
    if (event.defaultPrevented || !window.electron) return;

    event.preventDefault();
    void window.electron.openExternal(this.url()).catch((error: unknown): void => {
      console.error('The external link could not be opened.', error);
    });
  }
}
