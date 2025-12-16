import { Component, inject, OnInit } from '@angular/core';
import { WindowPanelState } from '../../components/panels/window-panel/window-panel.state';

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly windowPanelState: WindowPanelState = inject(WindowPanelState);

  public ngOnInit(): void {
    this.windowPanelState.setState({ title: 'NORI - A Model Layering Tool', icon: 'pi pi-home' });
  }
}
