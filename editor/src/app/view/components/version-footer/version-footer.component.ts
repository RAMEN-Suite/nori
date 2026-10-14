import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'nori-version-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  templateUrl: './version-footer.component.html',
})
export class VersionFooterComponent {
  protected readonly version: string = environment.appVersion;
}
