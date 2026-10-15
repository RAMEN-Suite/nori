import { inject, Injectable } from '@angular/core';
import { type ActivatedRoute, type NavigationExtras, Router, type UrlTree } from '@angular/router';
import { type WorkspaceLocation } from '../../models/WorkspaceLocation';
import { PARAMETERS } from '../../app-route-parameters';

/** Builds project, model-level, node and relation navigation from the current route. */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly router: Router = inject(Router);

  public async navigateToProject(projectId: string): Promise<void> {
    await this.navigateTo(['/ws', projectId, '1']);
  }

  public async navigateToLevel(levelIndex: number): Promise<void> {
    await this.navigateToNode(levelIndex, null);
  }

  public async navigateToNode(levelIndex: number, nodeId: string | null): Promise<void> {
    const projectId: string | null = this.getRouteParameter(PARAMETERS.PROJECT);
    if (!projectId) return;

    const commands: string[] = ['/ws', projectId, String(levelIndex)];
    if (nodeId !== null) commands.push(nodeId);

    const extras: NavigationExtras = nodeId !== null ? { queryParamsHandling: 'preserve' } : {};
    await this.navigateTo(commands, extras);
  }

  public async navigateToRelation(levelIndex: number, relationId: string): Promise<void> {
    const projectId: string | null = this.getRouteParameter(PARAMETERS.PROJECT);
    if (projectId) await this.navigateTo(['/ws', projectId, String(levelIndex), 'relation', relationId]);
  }

  public async navigateToLocation(location: WorkspaceLocation): Promise<boolean> {
    const route: string[] = ['/ws', location.projectId, String(location.levelIndex)];
    if (location.relationId) route.push('relation', location.relationId);
    else if (location.nodeId) route.push(location.nodeId);
    return this.navigateTo(route);
  }

  public async navigateToUrl(url: string): Promise<boolean> {
    return this.router.url === url || this.router.navigateByUrl(url);
  }

  private async navigateTo(route: string[], extras?: NavigationExtras): Promise<boolean> {
    const urlTree: UrlTree = this.router.createUrlTree(route, extras);
    const targetUrl: string = this.router.serializeUrl(urlTree);
    return this.router.url === targetUrl || this.router.navigateByUrl(urlTree);
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
