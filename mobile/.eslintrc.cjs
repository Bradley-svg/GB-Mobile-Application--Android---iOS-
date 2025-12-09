module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true,
    jest: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: { jsx: true },
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'react-native'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  ignorePatterns: ['node_modules', 'dist'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'no-restricted-syntax': [
      'error',
      {
        selector: "Literal[value=/^#(?:[0-9a-fA-F]{3}){1,2}$/]",
        message: 'Do not use raw hex colors. Use theme.colors.* via useAppTheme().',
      },
    ],
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['**/theme/colors'],
            message: 'Import colors via AppTheme/useAppTheme instead of using the legacy colors module.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['app/theme/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-syntax': 'off',
        'no-restricted-imports': 'off',
      },
    },
    {
      files: ['app/components/**/*.{ts,tsx}', 'app/screens/**/*.{ts,tsx}', 'app/theme/**/*.{ts,tsx}'],
      rules: {
        'react-native/no-unused-styles': 'warn',
        // TODO: promote to error after the next release once unused-style cleanup remains stable.
      },
    },
  ],
};
