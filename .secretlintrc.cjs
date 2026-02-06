/** @type {import('secretlint').SecretLintConfigDescriptor} */
module.exports = {
  rules: [{ id: '@secretlint/secretlint-rule-preset-recommend' }],
  ignores: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/out/**',
    '**/.wrangler/**',
    '**/.turbo/**',
    '**/pnpm-lock.yaml',
    '**/*.tsbuildinfo'
  ]
}
