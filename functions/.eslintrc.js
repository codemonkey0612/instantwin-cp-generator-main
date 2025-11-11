// functions/.eslintrc.js
module.exports = {
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['tsconfig.json', 'tsconfig.dev.json'],
    sourceType: 'module',
  },
  ignorePatterns: [
    '/lib/**/*', // Ignore built files.
    '/generated/**/*', // Ignore generated files.
    '*.js', // Ignore JavaScript files in root
    'node_modules/**/*' // Ignore node_modules
  ],
  plugins: [
    '@typescript-eslint'
  ],
  rules: {
    // You can add custom rules here
  },
};