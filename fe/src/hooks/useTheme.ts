import { useState, useEffect, useCallback } from 'react'

export type Theme = 'light' | 'contrast'

// index.html 인라인 스크립트와 같은 키를 사용 (첫 페인트 전에 data-theme을 먼저 세팅해 깜빡임 방지)
export const THEME_STORAGE_KEY = 'lotto-theme'

// 브라우저 상단 바 색상 (meta theme-color)
const THEME_COLORS: Record<Theme, string> = {
  light: '#eff6ff',
  contrast: '#000000',
}

function getInitialTheme(): Theme {
  return document.documentElement.dataset.theme === 'contrast' ? 'contrast' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
    // 사파리 비공개 모드 등 저장소 접근이 막힌 환경 대비
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      /* 저장 실패 시 이번 세션에서만 유지 */
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'contrast' : 'light'))
  }, [])

  return { theme, toggleTheme }
}
