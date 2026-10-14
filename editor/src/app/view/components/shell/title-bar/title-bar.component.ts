import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideNetwork, LucidePencil, LucideFolderPlus, LucideFolderOpen } from '@lucide/angular';
import { Button } from '@sushi-kit/angular';
import { type Electron } from '../../../../../types/electron';
import { WindowState } from '../../../../states/window.state';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'nori-title-bar',
  imports: [TranslocoPipe, Button, LucideNetwork, LucidePencil, LucideFolderPlus, LucideFolderOpen],
  templateUrl: './title-bar.component.html',
  styleUrl: './title-bar.component.scss',
})
export class TitleBarComponent {
  protected readonly electron: Electron | undefined = window.electron;
  protected readonly windowState: WindowState = inject(WindowState);

  protected readonly hasControls: boolean = window.platform !== 'darwin';
}
