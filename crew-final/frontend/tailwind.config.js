/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
      colors: {
        'royal-purple': '#4A3D8F',
        'purple-accent': '#6B5FA0',
        'amber-brand': '#D4880A',
        'amber-light': '#F0A830',
        'deep-ink': '#1C0A30',
        'dark-card': '#2A1A45',
        'lavender-grey': '#F4F2F8',
        'pale-purple': '#EDE8F5',
        'text-dark': '#1C0A30',
      },
      borderRadius: {
        '2xl': '20px',
        'pill': '50px',
      },
      animation: {
        'marquee': 'marquee 40s linear infinite',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
