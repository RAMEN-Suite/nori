import { Component, inject, OnInit } from '@angular/core';
import { WindowState } from '../../states/window.state';
import { Button } from 'primeng/button';

@Component({
  selector: 'app-home',
  imports: [Button],
  templateUrl: './home.screen.html',
  styleUrl: './home.screen.scss',
})
export class HomeScreen implements OnInit {
  private readonly windowState: WindowState = inject(WindowState);
  protected test: boolean = false;

  public ngOnInit(): void {
    this.windowState.setTitle('NORI - A Model Layering Tool', 'pi pi-home');
  }
}
