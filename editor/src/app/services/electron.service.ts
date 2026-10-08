import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ElectronService {
  public minimizeApplication(): void {
    window.electron?.minimise();
  }

  public maximizeApplication(): void {
    window.electron?.maximise();
  }

  public closeApplication(): void {
    window.electron?.close();
  }
}
