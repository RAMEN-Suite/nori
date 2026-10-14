import { inject } from '@angular/core';
import { type ActivatedRouteSnapshot, type CanActivateFn, Router, type UrlTree } from '@angular/router';
import { PARAMETERS } from '../app-route-parameters';
import { StorageService } from '../services/storage.service';

export const hasWorkspace: CanActivateFn = async (route: ActivatedRouteSnapshot): Promise<boolean | UrlTree> => {
  const router: Router = inject(Router);
  const storage: StorageService = inject(StorageService);

  const home: UrlTree = router.createUrlTree(['/']);
  const projectId: string | null = route.paramMap.get(PARAMETERS.PROJECT);
  if (!projectId) return home;

  try {
    return (await storage.isProjectExisting(projectId)) || home;
  } catch (error: unknown) {
    storage.reportError(error);
    return home;
  }
};
