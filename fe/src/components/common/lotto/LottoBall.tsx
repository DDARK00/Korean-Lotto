interface LottoBallProps {
  number: number
  size?: 'sm' | 'md' | 'lg'
  isMatched?: boolean
  isBonus?: boolean
}

function getColorClass(num: number): string {
  if (num >= 1 && num <= 10) return 'bg-lotto-yellow text-gray-900'
  if (num >= 11 && num <= 20) return 'bg-lotto-blue text-white'
  if (num >= 21 && num <= 30) return 'bg-lotto-red text-white'
  if (num >= 31 && num <= 40) return 'bg-lotto-gray text-white'
  return 'bg-lotto-green text-gray-900'
}

const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
}

export function LottoBall({ number, size = 'md', isMatched = false, isBonus = false }: LottoBallProps) {
  const colorClass = getColorClass(number)
  const sizeClass = sizeClasses[size]

  return (
    <div
      className={`
        ${sizeClass}
        ${colorClass}
        rounded-full
        flex items-center justify-center
        font-bold
        shadow-md
        transition-all duration-200
        ${isMatched ? 'ring-2 ring-offset-2 ring-green-500 scale-110' : ''}
        ${isBonus ? 'ring-2 ring-offset-2 ring-purple-500' : ''}
      `}
    >
      {number}
    </div>
  )
}
