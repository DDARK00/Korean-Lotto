interface LottoBallProps {
  number: number
  size?: 'sm' | 'md' | 'lg'
  isMatched?: boolean
  isBonus?: boolean
}

// 공 색상은 공식 색 고정, 글자색은 테마 토큰(ball-ink / ball-ink-inv)으로 분리
function getColorClass(num: number): string {
  if (num >= 1 && num <= 10) return 'bg-lotto-yellow text-ball-ink'
  if (num >= 11 && num <= 20) return 'bg-lotto-blue text-ball-ink-inv ball-text-shadow'
  if (num >= 21 && num <= 30) return 'bg-lotto-red text-ball-ink-inv ball-text-shadow'
  if (num >= 31 && num <= 40) return 'bg-lotto-gray text-ball-ink-inv ball-text-shadow'
  return 'bg-lotto-green text-ball-ink'
}

// 모바일(기본) → sm 이상에서 한 단계 크게
const sizeClasses = {
  sm: 'w-7 h-7 text-xs sm:w-8 sm:h-8 sm:text-sm',
  md: 'w-9 h-9 text-sm sm:w-10 sm:h-10 sm:text-base',
  lg: 'w-10 h-10 text-base sm:w-12 sm:h-12 sm:text-lg',
}

export function LottoBall({ number, size = 'md', isMatched = false, isBonus = false }: LottoBallProps) {
  const colorClass = getColorClass(number)
  const sizeClass = sizeClasses[size]

  return (
    <div
      className={`
        ${sizeClass}
        ${colorClass}
        shrink-0
        rounded-full
        flex items-center justify-center
        font-bold
        shadow-md
        transition-all duration-200
        ${isMatched ? 'ring-2 ring-offset-2 ring-match ring-offset-surface scale-110' : ''}
        ${isBonus ? 'ring-offset-2' : ''}
      `}
    >
      {number}
    </div>
  )
}
