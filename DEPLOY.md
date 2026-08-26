# Muga CRM — Deployment Guide

## Requirements
- Ubuntu 22 / PHP 8.1 / MySQL 8 / Apache 2.4
- Python 3 + ReportLab (`pip install reportlab pillow`)
- Composer (`composer install`)

## Fresh Installation

1. Clone repo to `/var/www/html/crm`
2. Create database:
```sql
CREATE DATABASE your_db_name CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'your_db_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL ON your_db_name.* TO 'your_db_user'@'localhost';
```
3. Import schema: `mysql -u your_db_user -p your_db_name < database.sql`
4. Copy config: `cp includes/config.example.php includes/config.php` and update DB credentials
5. Set permissions: `chown -R www-data:www-data /var/www/html/crm/uploads`

## Seed Credentials (change immediately after first login)
- Platform Admin: `hulisa.admin` / `your_seed_password`
- Tenant Admin:   `muga.admin`  / `your_seed_password`

## Cron Jobs

## SSL
Auto-renewed via certbot. Check with: `certbot certificates`
