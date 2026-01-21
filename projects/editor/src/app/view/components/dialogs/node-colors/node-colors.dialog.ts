import { Component, computed, inject, Signal } from '@angular/core';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { GNode } from '../../../../core/models/GModel';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { ScrollPanel } from 'primeng/scrollpanel';
import { InputText } from 'primeng/inputtext';
import { IftaLabel } from 'primeng/iftalabel';
import { ColorPicker } from 'primeng/colorpicker';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';

interface NodeColorOption {
  id: string;
  name: string;
}

@Component({
  selector: 'app-set-colors',
  imports: [ScrollPanel, InputText, IftaLabel, ColorPicker, FormsModule, Button, Tooltip],
  templateUrl: './node-colors.dialog.html',
  styleUrl: './node-colors.dialog.scss',
})
export class NodeColorsDialog {
  protected readonly dialogRef: DynamicDialogRef = inject(DynamicDialogRef);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  protected readonly nodeColorOptions: Signal<NodeColorOption[]> = computed((): NodeColorOption[] => {
    const baseNodes: GNode[] = this.workspace.view.baseNodes();
    return baseNodes.map((n: GNode): NodeColorOption => ({ id: n.id, name: n.name }));
  });

  protected async handleColorChange(baseId: string, hexColor: string): Promise<void> {
    this.workspace.store.updateSelectedNodeColor(baseId, hexColor);
  }

  protected async handleReset(): Promise<void> {
    this.workspace.store.setSelectedNodeColors({});
  }

  protected async handleSaveChanges(): Promise<void> {
    await this.workspace.actions.updateNodeColors();
    this.dialogRef.close();
  }
}
