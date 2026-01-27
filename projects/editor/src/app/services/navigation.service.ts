import { inject, Injectable } from '@angular/core';
import { ActivatedRoute, NavigationExtras, Router, UrlTree } from '@angular/router';
import { PARAMETERS } from '../app.routes';

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly router: Router = inject(Router);

  public async navigateToProject(projectId: string): Promise<void> {
    await this.navigateTo(['/ws', projectId]);
  }

  public async navigateToSlot(route: ActivatedRoute, slot: number): Promise<void> {
    await this.navigateToNode(route, slot, null);
  }

  public async navigateToNode(route: ActivatedRoute, slot: number, nodeId: string | null): Promise<void> {
    const projectId: string | null = this.getRouteParameter(route, PARAMETERS.PROJECT);
    if (!projectId) return;

    const commands: string[] = ['/ws', projectId, String(slot)];
    if (nodeId !== null) commands.push(nodeId);

    const extras: NavigationExtras = nodeId !== null ? { queryParamsHandling: 'preserve' } : {};
    await this.navigateTo(commands, extras);
  }

  private async navigateTo(route: string[], extras?: NavigationExtras): Promise<void> {
    const currentUrl: string = this.router.url;
    const urlTree: UrlTree = this.router.createUrlTree(route);
    const targetUrl: string = this.router.serializeUrl(urlTree);

    if (currentUrl === targetUrl) return;
    await this.router.navigate(route, extras);
  }

  private getRouteParameter(activatedRoute: ActivatedRoute, parameterName: string): string | null {
    let currentRoute: ActivatedRoute | null = activatedRoute;

    while (currentRoute) {
      const value: string | null = currentRoute.snapshot.paramMap.get(parameterName);
      if (value !== null) return value;
      currentRoute = currentRoute.parent;
    }

    return null;
  }
}
