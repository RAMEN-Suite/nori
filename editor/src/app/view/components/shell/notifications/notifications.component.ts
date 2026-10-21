import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Toast } from '@sushi-kit/angular';
import { ApplicationState } from '../../../../states/application.state';

@Component({
  selector: 'nori-notifications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  imports: [Toast, TranslocoPipe],
  template: `
    <sui-toast
      class="nori-notifications"
      horizontal="end"
      vertical="bottom"
      [maxVisible]="3"
      [dismissLabel]="'common.close' | transloco"
      [motion]="appearance.state().animations ? 'fade' : 'none'"
      [ariaLabel]="'common.notifications' | transloco"
    />
  `,
})
export class NotificationsComponent {
  protected readonly appearance: ApplicationState = inject(ApplicationState);
}
