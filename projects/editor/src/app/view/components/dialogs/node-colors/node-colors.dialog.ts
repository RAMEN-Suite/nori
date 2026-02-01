import { Component, computed, inject, OnDestroy, OnInit, Signal } from '@angular/core';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { GNode } from '../../../../core/models/GModel';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { ScrollPanel } from 'primeng/scrollpanel';
import { InputText } from 'primeng/inputtext';
import { IftaLabel } from 'primeng/iftalabel';
import { ColorPicker } from 'primeng/colorpicker';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { NodeColors } from '../../../../models/ModelRecord';

interface NodeColorOption {
  id: string;
  name: string;
}

@Component({
  selector: 'app-set-colors',
  imports: [ScrollPanel, InputText, IftaLabel, ColorPicker, FormsModule, Button],
  templateUrl: './node-colors.dialog.html',
  styleUrl: './node-colors.dialog.scss',
})
export class NodeColorsDialog implements OnInit, OnDestroy {
  protected readonly dialogRef: DynamicDialogRef = inject(DynamicDialogRef);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  protected currentColors: NodeColors = {};

  protected readonly nodeColorOptions: Signal<NodeColorOption[]> = computed((): NodeColorOption[] => {
    const baseNodes: ReadonlyArray<GNode> = this.workspace.view.baseNodes();
    return baseNodes.map((n: GNode): NodeColorOption => ({ id: n.id, name: n.name }));
  });

  public ngOnInit(): void {
    this.currentColors = this.workspace.store.currentNodeColors();
  }

  public ngOnDestroy(): void {
    void this.handleSaveChanges();
  }

  protected async handleColorChange(baseId: string, hexColor: string): Promise<void> {
    this.workspace.store.updateCurrentNodeColors(baseId, hexColor);
  }

  protected handleSaveChanges(): void {
    void this.workspace.actions.updateNodeColors();
    this.dialogRef.close();
  }
}
