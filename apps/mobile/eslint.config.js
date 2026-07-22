// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
    // TypeScript's bundler-aware resolver is authoritative for Expo package exports.
    // The legacy import resolver reports false positives for modern Expo/ESM packages.
    rules: {
      "import/no-unresolved": "off",
    },
  }
]);
