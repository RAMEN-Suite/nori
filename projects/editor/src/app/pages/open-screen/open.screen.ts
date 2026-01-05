import { Component, inject, OnInit } from '@angular/core';
import { WindowState } from '../../states/window.state';

@Component({
  selector: 'app-open',
  imports: [],
  templateUrl: './open.screen.html',
  styleUrl: './open.screen.scss',
})
export class OpenScreen implements OnInit {
  private readonly windowState: WindowState = inject(WindowState);

  public ngOnInit(): void {
    this.windowState.setTitle('Open Project', 'pi pi-folder-open');
  }
}
