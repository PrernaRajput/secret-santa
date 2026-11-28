import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'src/**/*', 'tests/**/*', 'firestore.rules.test.ts']
  },
  firebaseRulesPlugin.configs['flat/recommended']
];
