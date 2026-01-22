import { ActivatedRouteSnapshot, CanActivateFn, CanDeactivateFn, Router, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { StorageService } from '../services/storage.service';
import { PARAMETERS } from '../app.routes';

export interface CanDeactivate {
  ngCanDeactivate: () => boolean | Promise<boolean>;
}

export const hasWorkspace: CanActivateFn = async (route: ActivatedRouteSnapshot): Promise<boolean | UrlTree> => {
  const router: Router = inject(Router);
  const storage: StorageService = inject(StorageService);

  const projectId: string | null = route.paramMap.get(PARAMETERS.PROJECT);
  if (!projectId) return router.createUrlTree(['/']);

  const isProjectExisting: boolean = await storage.isProjectExisting(projectId);
  if (!isProjectExisting) return router.createUrlTree(['/']);

  return true;
};

export const hasUnsavedChanges: CanDeactivateFn<CanDeactivate> = async (component: CanDeactivate): Promise<boolean> => {
  return component.ngCanDeactivate();
};
