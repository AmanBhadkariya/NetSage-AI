export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17202a',
        console: '#eef4f6',
        panel: '#f8fafc',
        line: '#d9e2ec',
        signal: '#0f766e',
        'signal-soft': '#dff7f3',
        alert: '#b42318',
        amber: '#b45309',
        good: '#15803d',
      },
      boxShadow: {
        soft: '0 10px 30px rgba(23, 32, 42, 0.08)',
        panel: '0 16px 36px rgba(15, 118, 110, 0.14)',
      },
    },
  },
  plugins: [],
};
