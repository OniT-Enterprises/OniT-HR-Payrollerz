// pm2 declaration for xefe-api. Apply on server:
//   pm2 startOrReload ecosystem.config.js --update-env && pm2 save
//
// Deploy path on the Hetzner box is /opt/xefe-api (not the git tree),
// so this file ships with the rsync bundle.

module.exports = {
  apps: [
    {
      name: "xefe-api",
      cwd: __dirname,
      script: "index.js",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "500M",
      // Longer than the extraction ceiling (TABLE_TIMEOUT_MS, 180s) so PM2 waits
      // for index.js to drain in-flight uploads instead of SIGKILLing through
      // them. Without this a deploy 502s whoever was mid-upload.
      kill_timeout: 200000,
      env: { NODE_ENV: "production" },
    },
  ],
};
