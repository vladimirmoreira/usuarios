module.exports = {
  apps: [
    {
      name: 'usuarios-api',
      script: 'src/server.js',
      cwd: '/opt/nginx/usuarios/server',   // ruta en el servidor Rocky Linux
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env_production: {
        NODE_ENV: 'production',
      },
      // Reinicio automatico si usa mas de 400 MB
      max_memory_restart: '400M',
      // Logs
      out_file: '/var/log/nginx/usuarios/api-out.log',
      error_file: '/var/log/nginx/usuarios/api-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
