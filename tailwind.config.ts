import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        void: "#050505",
        cyan: "#00FFFF",
        amber: "#FFBF00",
        crimson: "#FF0033"
      }
    }
  },
  plugins: []
};

export default config;
