import { ChangeDetectionStrategy, Component, inject, signal, type WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, type ParamMap } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { Divider, Tab, Tabs } from '@sushi-kit/angular';
import { StorageService } from '../../../services/storage.service';
import { NodeAttributesComponent } from './node-attributes/node-attributes.component';
import { NodeBasicsComponent } from './node-basics/node-basics.component';
import { NodeRelationsComponent } from './node-relations/node-relations.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-node-editor',
  imports: [TranslocoDirective, NodeBasicsComponent, Divider, Tab, Tabs, NodeAttributesComponent, NodeRelationsComponent],
  templateUrl: './node-view.component.html',
  styleUrl: './node-view.component.scss',
})
export class NodeViewComponent {
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);
  private readonly storage: StorageService = inject(StorageService);

  protected readonly activeTab: WritableSignal<'attributes' | 'relations'> = signal('attributes');

  public constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params: ParamMap): void => {
      this.activeTab.set(params.get('tab') === 'relations' ? 'relations' : 'attributes');
    });
  }

  protected handleTab(tab: unknown): void {
    if (tab !== 'attributes' && tab !== 'relations') return;

    void this.router
      .navigate([], {
        relativeTo: this.route,
        queryParams: { tab },
        queryParamsHandling: 'merge',
      })
      .catch((error: unknown): void => this.storage.reportError(error));
  }
}
