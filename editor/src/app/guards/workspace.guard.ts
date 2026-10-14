import { inject } from '@angular/core';
import { type ActivatedRouteSnapshot, type CanActivateFn, Router, type UrlTree } from '@angular/router';
import { PARAMETERS } from '../app-route-parameters';
import { ProjectService } from '../services/projects/project.service';

export const hasWorkspace: CanActivateFn = async (route: ActivatedRouteSnapshot): Promise<boolean | UrlTree> => {
  const router: Router = inject(Router);
  const projects: ProjectService = inject(ProjectService);

  const home: UrlTree = router.createUrlTree(['/']);
  const projectId: string | null = route.paramMap.get(PARAMETERS.PROJECT);
  if (!projectId) return home;

  try {
    return (await projects.projectExists(projectId)) || home;
  } catch (error: unknown) {
    projects.reportError(error);
    return home;
  }
};
