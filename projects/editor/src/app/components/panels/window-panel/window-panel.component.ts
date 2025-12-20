import { Component, inject, OnInit } from '@angular/core';
import { Menubar } from 'primeng/menubar';
import { Button } from 'primeng/button';
import { Divider } from 'primeng/divider';
import { ElectronService } from '../../../services/electron.service';
import { WindowPanelState } from './window-panel.state';

@Component({
  selector: 'app-window-panel',
  imports: [Menubar, Button, Divider],
  templateUrl: './window-panel.component.html',
  styleUrl: './window-panel.component.scss',
})
export class WindowPanelComponent implements OnInit {
  protected readonly electron: ElectronService = inject(ElectronService);
  protected readonly windowPanelState: WindowPanelState = inject(WindowPanelState);

  protected hasControls: boolean = false;

  public async ngOnInit(): Promise<void> {
    this.hasControls = window.platform !== 'darwin';
  }
}
