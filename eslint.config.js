const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    // api/ é o back-end (Node), com config própria.
    ignores: ['dist/*', 'api/*'],
  },
];
