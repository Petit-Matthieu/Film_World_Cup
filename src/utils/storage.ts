import type { TournamentState } from '../types';
import { STORAGE_KEY } from '../constants';

export function saveState(state: TournamentState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('保存状态失败:', e);
  }
}

export function loadState(): TournamentState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    // 基本校验
    if (!parsed || typeof parsed !== 'object') return null;
    if (!('phase' in parsed)) return null;
    if (!('films' in parsed)) return null;

    return parsed as TournamentState;
  } catch {
    return null;
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('清除状态失败:', e);
  }
}
