export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17202a',
        panel: '#f8fafc',
        line: '#d9e2ec',
        signal: '#006d77',
        alert: '#b42318',
        amber: '#9a6700',
        good: '#1f7a4d',
      },
      boxShadow: {
        soft: '0 10px 30px rgba(23, 32, 42, 0.08)',
      },
    },
  },
  plugins: [],
};
