import { ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { StorageService } from '../services/storage.service';

export const workspaceGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot,
): Promise<boolean | UrlTree> => {
  const router: Router = inject(Router);
  const storage: StorageService = inject(StorageService);

  const projectId: string | null = route.paramMap.get('pid');
  if (!projectId) return router.parseUrl('/');

  const isProjectExisting: boolean = await storage.isProjectExisting(projectId);
  if (!isProjectExisting) return router.parseUrl('/');

  storage.selectProject(projectId);
  return true;
};
