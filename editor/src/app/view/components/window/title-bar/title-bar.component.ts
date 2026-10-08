import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Button } from '@sushi-kit/angular';
import { LucideNetwork } from '@lucide/angular';
import { ElectronService } from '../../../../services/electron.service';
import { WindowState } from '../../../../states/window.state';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-title-bar',
  imports: [Button, LucideNetwork],
  templateUrl: './title-bar.component.html',
  styleUrl: './title-bar.component.scss',
})
export class TitleBarComponent implements OnInit {
  protected readonly electron: ElectronService = inject(ElectronService);
  protected readonly windowState: WindowState = inject(WindowState);

  protected hasControls: boolean = false;

  public ngOnInit(): void {
    this.hasControls = window.platform !== 'darwin';
  }
}
