import { assertInInjectionContext, inject, Signal } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map, Observable } from 'rxjs';

type GetParamsFn = (params: Params) => string | null;

function deepest(currentRoute: ActivatedRoute): ActivatedRoute {
  let route: ActivatedRoute = currentRoute;
  while (route.firstChild) route = route.firstChild;
  return route;
}

export function injectDeepParams(key: string): Signal<string | null> {
  assertInInjectionContext(injectDeepParams);
  const route: ActivatedRoute = inject(ActivatedRoute);
  const last: ActivatedRoute = deepest(route);

  const getParam: GetParamsFn = (params: Params): string | null => params[key] ?? null;
  const param: Observable<string | null> = last.params.pipe(map(getParam), distinctUntilChanged());
  return toSignal(param, { requireSync: true });
}
