import { Component, inject } from '@angular/core';
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
export class WindowPanelComponent {
  public electron: ElectronService = inject(ElectronService);
  public windowPanelState: WindowPanelState = inject(WindowPanelState);
}
