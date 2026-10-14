import { Injectable } from '@angular/core';

/** Stores JSON preferences in localStorage and handles invalid data and failed writes. */
@Injectable({
  providedIn: 'root',
})
export class LocalStorageService {
  public get(key: string): unknown {
    try {
      const raw: string | null = localStorage.getItem(key);
      return raw === null ? null : JSON.parse(raw);
    } catch (error: unknown) {
      console.warn(`[LocalStorage] Failed to read key "${key}".`, error);
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
