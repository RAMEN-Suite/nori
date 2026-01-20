import {
  Component,
  computed,
  DestroyRef,
  inject,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { GraphComponent } from '../graph/graph.component';
import { GModel } from '../../../../../core/models/GModel';
import { GModelGraph, GraphData } from '../../../../../core/GModelGraph';
import { WorkspaceService } from '../../../../../services/workspace.service';
import { FormsModule } from '@angular/forms';
import { Menubar } from 'primeng/menubar';
import {
  DEFAULT_GRAPH_LAYOUT_SETTINGS,
  GraphLayoutMode,
  GraphLayoutSettings,
} from '../graph/graph.types';
import { SelectButton } from 'primeng/selectbutton';
import { ToggleButton } from 'primeng/togglebutton';
import { Tooltip } from 'primeng/tooltip';
import { Button } from 'primeng/button';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { NodeColorsDialog } from '../../../dialogs/node-colors/node-colors.dialog';

type LayoutToggleOption = 'areIsolatedNodesHidden';

interface ToggleOption {
  onIcon: string;
  offIcon: string;
  tooltip: string;
  option: LayoutToggleOption;
}

interface LayoutOption {
  label: string;
  icon: string;
  mode: GraphLayoutMode;
}

@Component({
  selector: 'app-visualizer',
  imports: [GraphComponent, FormsModule, Menubar, SelectButton, ToggleButton, Tooltip, Button],
  providers: [DialogService],
  templateUrl: './graph-menu.component.html',
  styleUrl: './graph-menu.component.scss',
})
export class GraphMenuComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  protected readonly destroyRef: DestroyRef = inject(DestroyRef);
  protected readonly dialogService: DialogService = inject(DialogService);
  protected dialogRef: DynamicDialogRef | null = null;

  protected layoutOptions: LayoutOption[] = [
    { label: 'Cluster', icon: 'pi pi-share-alt', mode: 'clusterTopDown' },
    { label: 'Tree', icon: 'pi pi-sitemap', mode: 'treeTopDown' },
  ];

  protected toggleOptions: ToggleOption[] = [
    {
      onIcon: 'pi pi-eye-slash',
      offIcon: 'pi pi-eye',
      tooltip: 'Toggle Isolated Nodes',
      option: 'areIsolatedNodesHidden',
    },
  ];

  protected settings: WritableSignal<GraphLayoutSettings> = signal({
    ...DEFAULT_GRAPH_LAYOUT_SETTINGS,
    padding: { ...DEFAULT_GRAPH_LAYOUT_SETTINGS.padding },
  });

  protected graphData: Signal<GraphData> = computed((): GraphData => {
    const model: GModel | null = this.workspace.view.slotModel();
    return new GModelGraph().build(model);
  });

  constructor() {
    this.destroyRef.onDestroy((): void => {
      this.dialogRef?.close();
      this.dialogRef = null;
    });
  }

  public handleSelectLayoutMode(layoutMode: GraphLayoutMode): void {
    this.settings.update((s: GraphLayoutSettings): GraphLayoutSettings => ({ ...s, layoutMode }));
  }

  public handleToggleOption(option: LayoutToggleOption): void {
    this.settings.update(
      (s: GraphLayoutSettings): GraphLayoutSettings => ({ ...s, [option]: !s[option] }),
    );
  }

  public handleOpenColorsDialog(): void {
    this.dialogRef?.close();
    this.dialogRef = this.dialogService.open(NodeColorsDialog, {
      header: 'Configure Node Colors',
      closeOnEscape: true,
      dismissableMask: true,
      draggable: true,
      closable: true,
    });
  }

  public handleLayoutReset(): void {
    this.handleSelectLayoutMode(this.settings().layoutMode);
  }
}
