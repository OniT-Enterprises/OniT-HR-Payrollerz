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
      env: { NODE_ENV: "production" },
    },
  ],
};
