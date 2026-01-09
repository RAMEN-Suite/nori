import { Component, inject, OnInit } from '@angular/core';
import { WindowState } from '../../states/window.state';
import { Button } from 'primeng/button';
import { environment } from '../../../environments/environment';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [Button, RouterLink],
  templateUrl: './home.screen.html',
  styleUrl: './home.screen.scss',
})
export class HomeScreen implements OnInit {
  private readonly windowState: WindowState = inject(WindowState);
  protected readonly environment = environment;

  public ngOnInit(): void {
    this.windowState.setTitle('NORI - A Model Layering Tool', 'pi pi-home');
  }
}
