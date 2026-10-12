import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideMousePointer2 } from '@lucide/angular';

@Component({
  selector: 'app-slot-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, LucideMousePointer2],
  templateUrl: './slot-view.component.html',
  styleUrl: './slot-view.component.scss',
})
export class SlotViewComponent {}
