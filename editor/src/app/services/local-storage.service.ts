import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LocalStorageService {
  public get<T>(key: string, fallback: T | null = null): T | null {
    const raw: string | null = localStorage.getItem(key);
    if (raw === null) return fallback;

    try {
      return JSON.parse(raw) as T;
    } catch {
      console.warn(`[LocalStorage] Invalid JSON for key "${key}", removing.`);
      localStorage.removeItem(key);
      return fallback;
    }
  }

  public set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error: unknown) {
      console.error(`[LocalStorage] Failed to set key "${key}".`, error);
    }
  }

  public remove(key: string): void {
    localStorage.removeItem(key);
  }
}
