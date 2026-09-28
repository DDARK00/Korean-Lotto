// 시맨틱 컬러는 CSS 변수(src/assets/theme.css)로 정의하고, 테마(라이트/고대비)는 변수 값만 교체
// rgb 채널 형태로 넣어야 bg-surface/90 같은 투명도 표기가 동작함
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`

const rank = (n) => ({
  DEFAULT: token(`rank${n}`),
  end: token(`rank${n}-end`),
  fg: token(`rank${n}-fg`),
})

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 로또 공 공식 색상 (기존 CDN 설정 이관)
        lotto: {
          yellow: '#FBC400',
          blue: '#69C8F2',
          red: '#FF7272',
          gray: '#AAAAAA',
          green: '#B0D840',
        },
        page: { from: token('page-from'), to: token('page-to') },
        surface: { DEFAULT: token('surface'), muted: token('surface-muted') },
        control: { DEFAULT: token('control'), hover: token('control-hover') },
        line: { DEFAULT: token('line'), card: token('line-card'), control: token('line-control') },
        fg: { DEFAULT: token('fg'), soft: token('fg-soft'), muted: token('fg-muted') },
        accent: { DEFAULT: token('accent'), hover: token('accent-hover'), fg: token('accent-fg') },
        danger: token('danger'),
        bonus: token('bonus'),
        up: token('up'),
        down: token('down'),
        match: token('match'),
        warn: { bg: token('warn-bg'), line: token('warn-line'), fg: token('warn-fg') },
        rank: {
          1: rank(1),
          2: rank(2),
          3: rank(3),
          4: rank(4),
          5: rank(5),
          none: { DEFAULT: token('rank-none'), fg: token('rank-none-fg') },
        },
        ball: { ink: token('ball-ink'), 'ink-inv': token('ball-ink-inv') },
      },
      fontFamily: {
        sans: ['"Noto Sans KR"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
