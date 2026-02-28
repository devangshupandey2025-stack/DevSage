/** @type {import('secretlint').SecretLintConfigDescriptor} */
module.exports = {
  rules: [
    {
      id: '@secretlint/secretlint-rule-preset-recommend',
      rules: [
        {
          id: '@secretlint/secretlint-rule-privatekey',
          allowMessageIds: ['PrivateKey'],
          allows: [
            // PEM header strings used for stripping format in signGitHubAppJWT() — not actual keys
            '/-----BEGIN PRIVATE KEY-----/',
            '/-----END PRIVATE KEY-----/',
          ],
        },
      ],
    },
  ],
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
