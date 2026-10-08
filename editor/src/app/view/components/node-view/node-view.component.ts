import { Component, inject, signal, WritableSignal, ChangeDetectionStrategy } from '@angular/core';
import { WorkspaceService } from '../../../services/workspace/workspace.service';
import { FormsModule } from '@angular/forms';
import { Button, Tab, Tabs } from '@sushi-kit/angular';
import { NodeBasicsComponent } from './node-basics/node-basics.component';

import { NodeAttributesComponent } from './node-attributes/node-attributes.component';
import { NodeRelationsComponent } from './node-relations/node-relations.component';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationService } from '../../../services/navigation.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-node-editor',
  imports: [FormsModule, Button, NodeBasicsComponent, Tab, Tabs, NodeAttributesComponent, NodeRelationsComponent],
  templateUrl: './node-view.component.html',
  styleUrl: './node-view.component.scss',
})
export class NodeViewComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  protected readonly navigation: NavigationService = inject(NavigationService);
  protected readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  protected readonly router: Router = inject(Router);

  protected readonly activeTab: WritableSignal<'attributes' | 'relations'> = signal('attributes');

  public constructor() {
    this.activatedRoute.queryParamMap.pipe(takeUntilDestroyed()).subscribe((queryParams: ParamMap): void => {
      const tab: string | null = queryParams.get('tab');
      this.activeTab.set(tab === 'relations' ? 'relations' : 'attributes');
    });
  }

  protected handleCloseView(): void {
    const selectedSlot: number = this.workspace.store.currentSlot();
    void this.navigation.navigateToSlot(selectedSlot);
  }

  protected handleTab(tab: unknown): void {
    if (tab !== 'attributes' && tab !== 'relations') return;

    void this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }
}
