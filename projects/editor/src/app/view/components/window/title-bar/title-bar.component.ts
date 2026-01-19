import { Component, inject, OnInit } from '@angular/core';
import { Menubar } from 'primeng/menubar';
import { Button } from 'primeng/button';
import { Divider } from 'primeng/divider';
import { ElectronService } from '../../../../services/electron.service';
import { WindowState } from '../../../../states/window.state';

@Component({
  selector: 'app-title-bar',
  imports: [Menubar, Button, Divider],
  templateUrl: './title-bar.component.html',
  styleUrl: './title-bar.component.scss',
})
export class TitleBarComponent implements OnInit {
  protected readonly electron: ElectronService = inject(ElectronService);
  protected readonly windowState: WindowState = inject(WindowState);

  protected hasControls: boolean = false;

  public async ngOnInit(): Promise<void> {
    this.hasControls = window.platform !== 'darwin';
  }
}
