/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Brand colors (consistent across themes)
        primary: "#F1B24A",
        secondary: "#7ED8C3",
        
        // Light theme colors
        light: {
          background: "#FFFFFF",
          text: "#000000",
          secondaryText: "#666666",
          card: "#F5F7FA",
          surface: "#FFFFFF",
          border: "#E0E0E0",
          input: "#FFFFFF"
        },
        
        // Dark theme colors
        dark: {
          background: "#232438", 
          text: "#FFFFFF",
          secondaryText: "#BBBBBB",
          card: "#2D2F45",
          surface: "#2D2F45",
          border: "#3D3F50",
          input: "#3D4059"
        }
      }
    },
  },
  plugins: [],
}