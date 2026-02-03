/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./node_modules/react-tailwindcss-datepicker/dist/index.esm.js",
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      // ✅ 여기에 추가합니다
      fontFamily: {
        sans: ['"Pretendard"', "sans-serif"], // 폰트 파일에 설정된 이름을 따옴표와 함께 넣으세요
      },
    },
  },
  plugins: [require("@tailwindcss/typography"), require("daisyui")],
  daisyui: {
    themes: ["light", "dark"],
  },
};
