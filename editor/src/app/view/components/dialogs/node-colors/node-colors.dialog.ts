import { Component, computed, inject, signal, type Signal, type WritableSignal, ChangeDetectionStrategy } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { ColorPicker, Button } from '@sushi-kit/angular';
import { type Node } from '@ramen-suite/core/model';
import { DialogService } from '../../../../services/dialog.service';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { type NodeColors } from '../../../../models/ModelRecord';
import iwanthue from 'iwanthue';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-set-colors',
  imports: [ColorPicker, Button, TranslocoDirective],
  templateUrl: './node-colors.dialog.html',
  styleUrl: './node-colors.dialog.scss',
})
export class NodeColorsDialog {
  protected readonly dialogRef: DialogService = inject(DialogService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly colours: WritableSignal<NodeColors> = signal(structuredClone(this.workspace.store.currentNodeColors()));
  protected readonly nodeColorOptions: Signal<readonly Node[]> = computed((): readonly Node[] =>
    this.workspace.view.baseModel() ? this.workspace.view.baseNodes() : this.workspace.view.currentNodes(),
  );

  protected handleGenerateColors(): void {
    const nodes: readonly Node[] = this.nodeColorOptions();
    if (!nodes.length) return;

    const palette: string[] = iwanthue(nodes.length, { colorSpace: 'colorblind' });
    this.colours.set(
      Object.fromEntries(nodes.map((node: Node, index: number): [string, string] => [node.id, palette[index] ?? '#64748b'])),
    );
  }

  protected handleColorChange(id: string, colour: string): void {
    this.colours.update((colours: NodeColors): NodeColors => ({ ...colours, [id]: colour }));
  }

  protected async handleSaveChanges(): Promise<void> {
    await this.dialogRef.run(async (): Promise<void> => {
      this.workspace.store.setCurrentNodeColors(this.colours());
      await this.workspace.actions.updateNodeColors();
    });
  }
}
