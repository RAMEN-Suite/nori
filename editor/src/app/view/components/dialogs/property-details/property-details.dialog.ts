import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  viewChild,
  type InputSignal,
  type Signal,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { Button } from '@sushi-kit/angular';
import type { Attribute } from '@ramen-suite/core/model';
import { DialogService } from '../../../../services/interaction/dialog.service';
import { PropertyEditingService } from '../../../../services/workspace/editing/property-editing.service';
import { ScrollOverflowDirective } from '../../../../directives/scroll-overflow.directive';
import { ScrollHintsComponent } from '../../shared/scroll-hints/scroll-hints.component';
import { NotificationService } from '../../../../services/interaction/notification.service';
import { NotificationsComponent } from '../../shell/notifications/notifications.component';
import { PropertyFormComponent } from '../../workspace/property-editor/property-form/property-form.component';

@Component({
  selector: 'nori-property-details-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [NotificationService],
  imports: [
    TranslocoDirective,
    Button,
    PropertyFormComponent,
    ScrollOverflowDirective,
    ScrollHintsComponent,
    NotificationsComponent,
  ],
  templateUrl: './property-details.dialog.html',
})
export class PropertyDetailsDialog {
  protected readonly dialogs: DialogService = inject(DialogService);
  private readonly editing: PropertyEditingService = inject(PropertyEditingService);
  public readonly attribute: InputSignal<Attribute | undefined> = input<Attribute>();
  public readonly editable: InputSignal<boolean> = input(true);
  public readonly levelIndex: InputSignal<number | null> = input<number | null>(null);
  protected readonly isAutoSaveEnabled: Signal<boolean> = computed((): boolean => !!this.attribute() && this.editable());
  protected readonly form: Signal<PropertyFormComponent | undefined> = viewChild(PropertyFormComponent);

  protected created(id: string): void {
    this.editing.select(id);
  }

  protected async save(): Promise<void> {
    const form: PropertyFormComponent | undefined = this.form();
    if (!form || this.dialogs.isPending()) return;
    this.dialogs.isPending.set(true);
    try {
      if ((await form.commit()) && !this.isAutoSaveEnabled()) this.dialogs.current.set(null);
    } finally {
      this.dialogs.isPending.set(false);
    }
  }
}
