import { ChangeDetectionStrategy, Component, input, output, type InputSignal, type OutputEmitterRef } from '@angular/core';
import { LucideX } from '@lucide/angular';
import { Button, Card } from '@sushi-kit/angular';

@Component({
  selector: 'app-editor-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Card, LucideX],
  templateUrl: './editor-panel.component.html',
  styleUrl: './editor-panel.component.scss',
})
export class EditorPanelComponent {
  public readonly title: InputSignal<string> = input.required<string>();
  public readonly closeLabel: InputSignal<string> = input.required<string>();
  public readonly open: InputSignal<boolean> = input(true);
  public readonly side: InputSignal<'left' | 'right'> = input<'left' | 'right'>('left');

  public readonly closePanel: OutputEmitterRef<void> = output();
}
