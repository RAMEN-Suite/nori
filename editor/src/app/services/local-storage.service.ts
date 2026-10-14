import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LocalStorageService {
  public get(key: string): unknown {
    const raw: string | null = localStorage.getItem(key);
    if (raw === null) return null;

    try {
      const value: unknown = JSON.parse(raw);
      return value;
    } catch {
      console.warn(`[LocalStorage] Invalid JSON for key "${key}", removing.`);
      localStorage.removeItem(key);
      return null;
    }
  }

  public set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error: unknown) {
      console.error(`[LocalStorage] Failed to set key "${key}".`, error);
    }
  }
}
