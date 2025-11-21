/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // User defined palette
        background: '#fffffe',
        headline: '#272343',
        paragraph: '#2d334a',
        button: '#ffd803',
        'button-text': '#272343',
        'illustration-stroke': '#272343',
        'illustration-main': '#fffffe',
        'illustration-highlight': '#ffd803',
        'illustration-secondary': '#e3f6f5',
        'illustration-tertiary': '#bae8e8',

        // Dark text colors for light backgrounds
        'text-primary': '#272343',    // Same as headline
        'text-secondary': '#2d334a',  // Same as paragraph
        'text-muted': '#4a5568',      // Dark gray for secondary text
        'text-accent': '#1e40af',     // Same as primary

        primary: '#1e40af',
        secondary: '#0ea5e9',
      },
      // Ensure text colors are consistently dark
      textColor: {
        primary: '#272343',
        secondary: '#2d334a',
        muted: '#4a5568',
        accent: '#1e40af',
      },
    },
  },
  plugins: [],
}

