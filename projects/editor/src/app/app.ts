import { Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { WindowPanelComponent } from './components/panels/window-panel/window-panel.component';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [ButtonModule, WindowPanelComponent, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  public isElectronRuntime: boolean = !!window.electron;
}
