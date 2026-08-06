#!/bin/sh
set -e

echo "[entrypoint] Writing .env from BACKEND_ENV..."
printf '%s' "$BACKEND_ENV" > /var/www/html/.env

echo "[entrypoint] Discovering packages..."
php artisan package:discover --ansi

echo "[entrypoint] Caching config & routes..."
php artisan config:cache
php artisan route:cache

echo "[entrypoint] Running migrations..."
php artisan migrate --force

echo "[entrypoint] Seeding database..."
php artisan db:seed --force

echo "[entrypoint] Setting storage permissions..."
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

echo "[entrypoint] Starting supervisord (nginx + php-fpm)..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
