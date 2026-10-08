/* PM2 process definition for the Bengol Spices API.
 *
 * .cjs on purpose: BackEnd/package.json sets "type": "module", so a plain
 * ecosystem.config.js there would be parsed as an ES module and PM2 would
 * fail with "module is not defined".
 *
 * Fork mode with a single instance, not cluster: the app is the only writer
 * for things like invoice numbering and target rollovers, and a second
 * worker would duplicate that work.
 *
 * The admin panel's live "new order" notifications depend on this too. Open
 * panels are tracked in the process's memory (services/liveEvents.js), so
 * with two workers an order handled by one would never reach a panel
 * connected to the other. The login attempt limiter is in memory as well.
 */
module.exports = {
  apps: [
    {
      name: "bengol-api",
      cwd: "/var/www/Bengol-Spices-V2/BackEnd",
      script: "server.js",
      exec_mode: "fork",
      instances: 1,

      // server.js calls dotenv itself, this is only a fallback/override
      env: {
        NODE_ENV: "production",
        PORT: 8000,
      },

      // On a restart the app stops taking requests, lets the ones in
      // progress finish (an order being placed, a payment being recorded)
      // and then exits; see the end of server.js. PM2 waits only 1.6
      // seconds by default before killing the process outright, which cuts
      // those requests off. The app gives up waiting after 10 seconds itself.
      kill_timeout: 12000,

      autorestart: true,
      max_restarts: 10,
      min_uptime: "20s",
      restart_delay: 3000,

      // Restart if the process leaks past this, small VPS plans are tight
      max_memory_restart: "400M",

      error_file: "/var/log/bengol-api/error.log",
      out_file: "/var/log/bengol-api/out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
