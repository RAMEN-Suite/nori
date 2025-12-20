import { Component, inject, OnInit } from '@angular/core';
import { EditorPanelComponent } from '../../components/panels/editor-panel/editor-panel.component';
import { WindowPanelState } from '../../components/panels/window-panel/window-panel.state';

@Component({
  selector: 'app-editor',
  imports: [EditorPanelComponent],
  templateUrl: './editor.screen.html',
  styleUrl: './editor.screen.scss',
})
export class EditorScreen implements OnInit {
  private readonly windowPanelState: WindowPanelState = inject(WindowPanelState);

  public ngOnInit(): void {
    this.windowPanelState.setTitle('Projektbezeichnung', 'pi pi-pen-to-square');
  }
}
