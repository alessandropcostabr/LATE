# Cron sugerido para atualizar materialized views do CRM a cada 10 minutos
# Rodar como usuário da app (ex.: late_dev_app) ou via root com sudo -u
*/10 * * * * cd /home/alessandro/late-dev && NODE_ENV=production node scripts/refresh-crm-stats.js >> /var/log/late-crm-stats.log 2>&1
