/**
 * Shared preferences for the RaulClippy widget. Lives in localStorage so it
 * stays per-device (different sizes feel right on different screens). When
 * one component (Settings) writes new prefs, the other (the widget itself)
 * listens for a CustomEvent and updates without a page reload.
 */

export type ClippyMode = 'on' | 'mascot' | 'off'
export type ClippySize = 'sm' | 'md' | 'lg'

export interface ClippyPrefs {
  mode: ClippyMode
  size: ClippySize
}

const STORAGE_KEY = 'nu_clippy_prefs_v1'
export const CLIPPY_PREFS_EVENT = 'nu:clippy-prefs-changed'

export const CLIPPY_DEFAULT_PREFS: ClippyPrefs = {
  mode: 'on',
  size: 'md',
}

export function getClippyPrefs(): ClippyPrefs {
  if (typeof localStorage === 'undefined') return CLIPPY_DEFAULT_PREFS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return CLIPPY_DEFAULT_PREFS
    const parsed = JSON.parse(raw)
    return {
      mode:
        parsed.mode === 'mascot' || parsed.mode === 'off' || parsed.mode === 'on'
          ? parsed.mode
          : CLIPPY_DEFAULT_PREFS.mode,
      size:
        parsed.size === 'sm' || parsed.size === 'lg' || parsed.size === 'md'
          ? parsed.size
          : CLIPPY_DEFAULT_PREFS.size,
    }
  } catch {
    return CLIPPY_DEFAULT_PREFS
  }
}

export function setClippyPrefs(prefs: ClippyPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    window.dispatchEvent(new CustomEvent(CLIPPY_PREFS_EVENT))
  } catch {
    /* ignore */
  }
}

/**
 * Tailwind classes per size. Body text + counter + avatar dimensions
 * scale together so the widget feels balanced at every size.
 *
 * Baseline `md` is +20% over the old fixed widget (was 10.5px → now 12.5px).
 */
export const CLIPPY_SIZE_STYLES: Record<
  ClippySize,
  {
    bubblePadding: string
    bubbleMaxW: string
    bubbleMinW: string
    body: string
    cursor: string
    meta: string
    avatar: string
    pulse: string
  }
> = {
  sm: {
    bubblePadding: 'px-3 py-2',
    bubbleMaxW: 'max-w-[240px]',
    bubbleMinW: 'min-w-[170px]',
    body: 'text-[10.5px]',
    cursor: 'h-[10px]',
    meta: 'text-[8px]',
    avatar: 'w-11 h-11',
    pulse: 'w-2 h-2',
  },
  md: {
    bubblePadding: 'px-3.5 py-2.5',
    bubbleMaxW: 'max-w-[300px]',
    bubbleMinW: 'min-w-[200px]',
    body: 'text-[12.5px]',
    cursor: 'h-[12px]',
    meta: 'text-[10px]',
    avatar: 'w-14 h-14',
    pulse: 'w-2.5 h-2.5',
  },
  lg: {
    bubblePadding: 'px-4 py-3',
    bubbleMaxW: 'max-w-[360px]',
    bubbleMinW: 'min-w-[240px]',
    body: 'text-[15px]',
    cursor: 'h-[14px]',
    meta: 'text-[11px]',
    avatar: 'w-16 h-16',
    pulse: 'w-3 h-3',
  },
}
