import { Component, inject, OnInit } from '@angular/core';
import { WindowState } from '../../states/window.state';
import { ToolBarComponent } from '../../components/bars/tool-bar/tool-bar.component';

@Component({
  selector: 'app-workspace',
  imports: [ToolBarComponent],
  templateUrl: './workspace.screen.html',
  styleUrl: './workspace.screen.scss',
})
export class WorkspaceScreen implements OnInit {
  private readonly windowState: WindowState = inject(WindowState);

  public ngOnInit(): void {
    this.windowState.setTitle('Projektbezeichnung', 'pi pi-pen-to-square');
  }
}
