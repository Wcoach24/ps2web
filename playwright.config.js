// @ts-check
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:8080', headless: true },
  webServer: {
    command: 'python3 tools/serve.py dist 8080',
    url: 'http://localhost:8080',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
