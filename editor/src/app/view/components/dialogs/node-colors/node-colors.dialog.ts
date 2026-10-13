import { ChangeDetectionStrategy, Component, computed, inject, signal, type Signal, type WritableSignal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideRotateCcw, LucideShuffle, LucideChevronsDown } from '@lucide/angular';
import { type Node } from '@ramen-suite/core/model';
import { Button, ColorPicker, List, ListItemTemplate } from '@sushi-kit/angular';
import iwanthue from 'iwanthue';
import { getDefaultNodeColours } from '../../../../core/utils/NodeColours';
import { ScrollOverflowDirective } from '../../../../directives/scroll-overflow.directive';
import { type NodeColors } from '../../../../models/ModelRecord';
import { DialogService } from '../../../../services/dialog.service';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-set-colors',
  imports: [
    ScrollOverflowDirective,
    LucideChevronsDown,
    ColorPicker,
    Button,
    List,
    ListItemTemplate,
    TranslocoDirective,
    LucideRotateCcw,
    LucideShuffle,
  ],
  templateUrl: './node-colors.dialog.html',
  styleUrl: './node-colors.dialog.scss',
})
export class NodeColorsDialog {
  protected readonly dialogs: DialogService = inject(DialogService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  private readonly recordId: string | null = this.workspace.store.currentModelRecord()?.modelId ?? null;
  private pendingColours: NodeColors | null = null;
  protected readonly colours: WritableSignal<NodeColors> = signal(structuredClone(this.workspace.store.currentNodeColors()));

  protected readonly nodes: Signal<readonly Node[]> = computed((): readonly Node[] =>
    this.workspace.view.baseModel() ? this.workspace.view.baseNodes() : this.workspace.view.currentNodes(),
  );

  protected async handleGenerateColours(): Promise<void> {
    const nodes: readonly Node[] = this.nodes();
    if (!nodes.length) return;

    const palette: string[] = iwanthue(nodes.length, { colorSpace: 'pastel' });
    await this.applyColours({
      ...this.colours(),
      ...Object.fromEntries(nodes.map((node: Node, index: number): [string, string] => [node.id, palette[index] ?? '#789cc2'])),
    });
  }

  protected async handleResetColours(): Promise<void> {
    await this.applyColours(getDefaultNodeColours(this.workspace.store.getModels()));
  }

  protected async handleColourChange(id: string, colour: string): Promise<void> {
    await this.applyColours({ ...this.colours(), [id]: colour });
  }

  private async applyColours(colours: NodeColors): Promise<void> {
    const recordId: string | null = this.recordId;
    if (!recordId || this.workspace.store.currentModelRecord()?.modelId !== recordId) return;

    const previous: NodeColors = this.colours();
    this.pendingColours = colours;
    this.colours.set(colours);
    this.workspace.store.setCurrentNodeColors(colours);

    if (this.dialogs.pending()) return;

    await this.dialogs.run((): Promise<void> => this.persistColours(recordId, previous), { closeOnSuccess: false });
  }

  private async persistColours(recordId: string, saved: NodeColors): Promise<void> {
    try {
      while (this.pendingColours) {
        const colours: NodeColors = this.pendingColours;
        this.pendingColours = null;
        await this.workspace.actions.updateNodeColors(recordId, colours);
        saved = colours;
      }
    } catch (error: unknown) {
      this.pendingColours = null;
      this.colours.set(saved);
      if (this.workspace.store.currentModelRecord()?.modelId === recordId) {
        this.workspace.store.setCurrentNodeColors(saved);
      }
      throw error;
    }
  }
}
