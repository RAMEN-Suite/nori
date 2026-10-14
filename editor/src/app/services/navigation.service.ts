import { inject, Injectable } from '@angular/core';
import { ActivatedRoute, NavigationExtras, Router, UrlTree } from '@angular/router';
import { PARAMETERS } from '../app-route-parameters';

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly router: Router = inject(Router);

  public async navigateToProject(projectId: string): Promise<void> {
    await this.navigateTo(['/ws', projectId, '1']);
  }

  public async navigateToSlot(slot: number): Promise<void> {
    await this.navigateToNode(slot, null);
  }

  public async navigateToNode(slot: number, nodeId: string | null): Promise<void> {
    const projectId: string | null = this.getRouteParameter(PARAMETERS.PROJECT);
    if (!projectId) return;

    const commands: string[] = ['/ws', projectId, String(slot)];
    if (nodeId !== null) commands.push(nodeId);

    const extras: NavigationExtras = nodeId !== null ? { queryParamsHandling: 'preserve' } : {};
    await this.navigateTo(commands, extras);
  }

  public async navigateToRelation(slot: number, relationId: string): Promise<void> {
    const projectId: string | null = this.getRouteParameter(PARAMETERS.PROJECT);
    if (projectId) await this.navigateTo(['/ws', projectId, String(slot), 'relation', relationId]);
  }

  private async navigateTo(route: string[], extras?: NavigationExtras): Promise<void> {
    const currentUrl: string = this.router.url;
    const urlTree: UrlTree = this.router.createUrlTree(route, extras);
    const targetUrl: string = this.router.serializeUrl(urlTree);

    if (currentUrl === targetUrl) return;
    await this.router.navigate(route, extras);
  }

  private getRouteParameter(parameterName: string): string | null {
    let currentRoute: ActivatedRoute | null = this.router.routerState.root;

    while (currentRoute) {
      const value: string | null = currentRoute.snapshot.paramMap.get(parameterName);
      if (value !== null) return value;
      currentRoute = currentRoute.firstChild;
    }

    return null;
  }
}
