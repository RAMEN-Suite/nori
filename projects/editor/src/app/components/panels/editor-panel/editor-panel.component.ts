import { Component, inject, Input } from '@angular/core';
import { Menubar } from 'primeng/menubar';
import { MenuItem } from 'primeng/api';
import { Divider } from 'primeng/divider';
import { Button } from 'primeng/button';
import { EDITOR_THEME, EditorPanelState } from './editor-panel.state';

@Component({
  selector: 'app-editor-panel',
  imports: [Menubar, Divider, Button],
  templateUrl: './editor-panel.component.html',
  styleUrl: './editor-panel.component.scss',
})
export class EditorPanelComponent {
  protected readonly EDITOR_THEME: typeof EDITOR_THEME = EDITOR_THEME;
  protected readonly editorStatePanel: EditorPanelState = inject(EditorPanelState);

  @Input() menuItems: MenuItem[] = [];
}
