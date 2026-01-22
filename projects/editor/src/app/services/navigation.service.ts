import { inject, Injectable } from '@angular/core';
import { ActivatedRoute, Router, UrlTree } from '@angular/router';
import { PARAMETERS } from '../app.routes';

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly router: Router = inject(Router);

  public async navigateToProject(projectId: string): Promise<void> {
    await this.navigateTo(['/ws', projectId]);
  }

  public async navigateToSlot(route: ActivatedRoute, slot: number | null): Promise<void> {
    await this.navigateToNode(route, slot, null);
  }

  public async navigateToNode(route: ActivatedRoute, slot: number | null, nodeId: string | null): Promise<void> {
    const projectId: string | null = this.getRouteParameter(route, PARAMETERS.PROJECT);
    if (!projectId) return;

    const commands: string[] = ['/ws', projectId];
    if (slot !== null) commands.push(String(slot));
    if (slot !== null && nodeId !== null) commands.push(nodeId);

    await this.navigateTo(commands);
  }

  private async navigateTo(route: string[]): Promise<void> {
    const currentUrl: string = this.router.url;
    const urlTree: UrlTree = this.router.createUrlTree(route);
    const targetUrl: string = this.router.serializeUrl(urlTree);

    if (currentUrl === targetUrl) return;
    await this.router.navigate(route);
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
