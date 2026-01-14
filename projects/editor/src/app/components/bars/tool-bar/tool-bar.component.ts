import { Component, EventEmitter, inject, Output } from '@angular/core';
import { Menubar } from 'primeng/menubar';
import { Divider } from 'primeng/divider';
import { Button } from 'primeng/button';
import { EDITOR_THEME, EditorState } from '../../../states/editor.state';
import { BreadcrumbsComponent } from '../../breadcrumb/breadcrumbs.component';

//Todo, move breadcrumbs to component

@Component({
  selector: 'app-tool-bar',
  imports: [Menubar, Divider, Button, BreadcrumbsComponent],
  templateUrl: './tool-bar.component.html',
  styleUrl: './tool-bar.component.scss',
})
export class ToolBarComponent {
  protected readonly EDITOR_THEME: typeof EDITOR_THEME = EDITOR_THEME;
  protected readonly editorState: EditorState = inject(EditorState);

  @Output() openCreateModal: EventEmitter<void> = new EventEmitter();
}
