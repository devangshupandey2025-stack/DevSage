/** @type {import('lint-staged').Config} */
module.exports = {
  '**/*.{ts,tsx,js,jsx,mjs,cjs,json,jsonc,yml,yaml,md,txt,css,html,sh}': [
    'secretlint --maskSecrets --format compact'
  ]
}
