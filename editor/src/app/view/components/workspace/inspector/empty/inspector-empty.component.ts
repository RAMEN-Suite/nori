import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideMousePointer2 } from '@lucide/angular';

@Component({
  selector: 'nori-inspector-empty',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, LucideMousePointer2],
  templateUrl: './inspector-empty.component.html',
  styleUrl: './inspector-empty.component.scss',
})
export class InspectorEmptyComponent {}
