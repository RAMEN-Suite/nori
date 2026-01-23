import { Component, inject, input, InputSignal, model, ModelSignal } from '@angular/core';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { Bounds, GAttribute } from '../../../../../../core/models/GModel';
import { WorkspaceService } from '../../../../../../services/workspace/workspace.service';
import { NavigationService } from '../../../../../../services/navigation.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-node-attribute',
  imports: [Button, Tooltip],
  templateUrl: './node-attribute.component.html',
  styleUrl: './node-attribute.component.scss',
})
export class NodeAttributeComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly navigation: NavigationService = inject(NavigationService);
  protected readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);

  public nodeId: InputSignal<string | undefined> = input();
  public modelId: InputSignal<string | undefined> = input();
  public modelSlot: InputSignal<number> = input(0);

  public attribute: ModelSignal<GAttribute | undefined> = model();

  protected formatAttributeType(bounds: Bounds, typeName: string): string {
    const { lowerBound, upperBound } = bounds;
    const isRequired: boolean = lowerBound > 0;
    const requiredSuffix: string = isRequired ? '!' : '';

    if (upperBound === 1) return `${typeName}${requiredSuffix}`;
    if (upperBound === -1) return `[${typeName}]${requiredSuffix}`;
    if (upperBound > 1) return `[${typeName}](${upperBound})${requiredSuffix}`;
    return `${typeName}${requiredSuffix}`;
  }

  protected handleOpenQualifiedReference(): void {
    const slot: number | undefined = this.modelSlot();
    const nodeId: string | undefined = this.nodeId();
    if (!slot || !nodeId || slot === 0) return;

    void this.navigation.navigateToNode(this.activatedRoute, slot, nodeId);
  }
}
