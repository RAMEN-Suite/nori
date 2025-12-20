import { Component, inject, OnInit } from '@angular/core';
import { WindowPanelState } from '../../components/panels/window-panel/window-panel.state';
import { EditorPanelComponent } from '../../components/panels/editor-panel/editor-panel.component';

@Component({
  selector: 'app-dashboard',
  imports: [EditorPanelComponent],
  templateUrl: './dashboard.screen.html',
  styleUrl: './dashboard.screen.scss',
})
export class DashboardScreen implements OnInit {
  private readonly windowPanelState: WindowPanelState = inject(WindowPanelState);

  public ngOnInit(): void {
    this.windowPanelState.setTitle('NORI - A Model Layering Tool', 'pi pi-home');
  }
}
