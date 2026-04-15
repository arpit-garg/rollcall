/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#092635",
        mist: "#f4f7f8",
        ember: "#ef8354",
        pine: "#1f7a5c",
        steel: "#5c677d"
      }
    }
  },
  plugins: []
};
