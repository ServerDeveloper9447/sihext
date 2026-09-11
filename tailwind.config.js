/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./popup.html",
    "./sidepanel.html",
    "./options.html",
    "./offscreen.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Instrument Serif"', 'Newsreader', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'Matter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        sarvam: {
          bg: "#0d0f17",
          card: "#131622",
          cardHover: "#181c2b",
          border: "#22273b",
          borderHover: "#353d5a",
          indigo: "#6a88e2",
          indigoLight: "#a5bbfc",
          indigoDark: "#3a3f5c",
          indigoDeep: "#1e2033",
          text: "#f8f9fb",
          secondary: "#9da4b8",
          tertiary: "#646d84",
          emerald: "#2dd4bf",
          amber: "#fbbf24",
          rose: "#fb7185",
        },
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5bbfc",
          400: "#818cf8",
          500: "#6a88e2",
          600: "#4f46e5",
          700: "#3a3f5c",
          800: "#1e2033",
          900: "#0d0f17",
        },
      },
      animation: {
        'pulse-subtle': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
      }
    },
  },
  plugins: [],
};
