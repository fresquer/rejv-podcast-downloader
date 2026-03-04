/**
 * Configuración PM2 para rejv-last-episodes-sync.
 * Uso: pm2 start ecosystem.config.cjs
 *
 * - Al hacer pm2 start, el sync se ejecuta inmediatamente (primera vez).
 * - autorestart: false → al terminar no se reinicia hasta el próximo cron.
 * - cron_restart: vuelve a ejecutar cada día a las 3:00.
 */
module.exports = {
  apps: [
    {
      name: 'rejv-sync',
      script: 'src/index.js',
      cwd: __dirname,
      autorestart: false,
      cron_restart: '0 3 * * *', // Todos los días a las 3:00
      env: {
        NODE_ENV: 'production',
      },
      // Opcional: guardar logs con PM2
      out_file: './logs/rejv-sync-out.log',
      error_file: './logs/rejv-sync-err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
