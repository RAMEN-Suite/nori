import { inject, Injectable } from '@angular/core';
import { ActivatedRoute, Router, UrlTree } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class WorkspaceUtils {
  private readonly router: Router = inject(Router);

  public async navigate(activatedRoute: ActivatedRoute, route: Array<string | number>): Promise<void> {
    const targetTree: UrlTree = this.router.createUrlTree(route, { relativeTo: activatedRoute });

    const currentUrl: string = this.router.url;
    const targetUrl: string = this.router.serializeUrl(targetTree);
    if (currentUrl === targetUrl) return;

    await this.router.navigateByUrl(targetTree, { replaceUrl: true });
  }
}
