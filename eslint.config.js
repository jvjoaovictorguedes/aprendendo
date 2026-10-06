const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    // supabase/functions roda no Deno (Edge Functions), não no app.
    ignores: ['dist/*', 'supabase/functions/*'],
  },
];
