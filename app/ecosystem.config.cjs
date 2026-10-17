/**
 * PM2 process file for VPS hosting.
 *   npm run build
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup
 *
 * Two processes: the web app and the check worker (runs due checks every 15 s).
 * Set the same CRON_SECRET for both (or copy it from Admin → System → Scheduler).
 */
const CRON_SECRET = process.env.CRON_SECRET || "change-me-to-a-long-random-string";

module.exports = {
  apps: [
    {
      name: "statuszen",
      script: "server.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        CRON_SECRET,
      },
      max_memory_restart: "512M",
    },
    {
      name: "statuszen-worker",
      script: "scripts/worker.mjs",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        CRON_SECRET,
      },
      max_memory_restart: "128M",
    },
  ],
};
