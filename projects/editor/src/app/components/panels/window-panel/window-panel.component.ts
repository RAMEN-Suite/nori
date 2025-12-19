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
  public hasControls: boolean = false;

  public electron: ElectronService = inject(ElectronService);
  public windowPanelState: WindowPanelState = inject(WindowPanelState);

  public async ngOnInit(): Promise<void> {
    this.hasControls = window.platform !== 'darwin';
  }
}
