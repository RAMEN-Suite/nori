import { Component, inject, Input } from '@angular/core';
import { Menubar } from 'primeng/menubar';
import { MenuItem } from 'primeng/api';
import { Divider } from 'primeng/divider';
import { Button } from 'primeng/button';
import { EDITOR_THEME, EditorState } from '../../../states/editor.state';

@Component({
  selector: 'app-tool-bar',
  imports: [Menubar, Divider, Button],
  templateUrl: './tool-bar.component.html',
  styleUrl: './tool-bar.component.scss',
})
export class ToolBarComponent {
  protected readonly EDITOR_THEME: typeof EDITOR_THEME = EDITOR_THEME;
  protected readonly editorState: EditorState = inject(EditorState);

  @Input() menuItems: MenuItem[] = [];
}
