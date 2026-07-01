/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Space Mono"', 'monospace'],
        serif: ['"Space Mono"', 'monospace'],
        mono: ['"Space Mono"', 'monospace'],
      },
      colors: {
        window: 'var(--bg-window)',
        main: 'var(--bg-main)',
        header: 'var(--bg-header)',
        primary: 'var(--primary)',
        'primary-text': 'var(--text-on-primary)',
        secondary: 'var(--secondary)',
        'secondary-text': 'var(--text-on-secondary)',
        accent: 'var(--accent)',
        'accent-text': 'var(--text-on-accent)',
        border: 'var(--border)',
        'border-text': 'var(--text-on-border)',
        'header-text': 'var(--text-on-header)',
        'main-text': 'var(--text-main)',
        'muted-text': 'var(--text-muted)',
        disabled: 'var(--bg-disabled)',
        'disabled-text': 'var(--text-disabled)',
        success: 'var(--color-success)',
        'success-text': 'var(--text-on-success)',
        warning: 'var(--color-warning)',
        'warning-text': 'var(--text-on-warning)',
        danger: 'var(--color-danger)',
        'danger-text': 'var(--text-on-danger)',
      }
    },
  },
  plugins: [],
}
