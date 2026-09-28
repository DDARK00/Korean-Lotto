import { useTheme } from '@hooks/useTheme'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isContrast = theme === 'contrast'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isContrast}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
                 bg-surface text-fg border border-line-control shadow-sm
                 hover:bg-control-hover transition-colors
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {/* 반원 아이콘: 채워진 쪽이 현재 모드 */}
      <svg aria-hidden="true" viewBox="0 0 16 16" className="w-4 h-4">
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill="currentColor" />
      </svg>
      고대비
    </button>
  )
}
