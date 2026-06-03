export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg:     "#07090f",
        panel:  "#0c1120",
        border: "#1a2740",
        accent: "#00c8f0",
        bull:   "#00e676",
        bear:   "#ff3355",
        warn:   "#ffd600",
        dim:    "#3a4e6a",
        text:   "#c0d0e8",
      },
      fontFamily: { mono: ["JetBrains Mono", "Consolas", "monospace"] },
    },
  },
  plugins: [],
};
