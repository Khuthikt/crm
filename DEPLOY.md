# Muga CRM — Deployment Guide

## Requirements
- Ubuntu 22 / PHP 8.1 / MySQL 8 / Apache 2.4
- Python 3 + ReportLab (`pip install reportlab pillow`)
- Composer (`composer install`)

## Fresh Installation

1. Clone repo to `/var/www/html/crm`
2. Create database:
```sql
CREATE DATABASE crm_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'crm_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL ON crm_db.* TO 'crm_user'@'localhost';
```
3. Import schema: `mysql -u crm_user -p crm_db < database.sql`
4. Copy config: `cp includes/config.example.php includes/config.php` and update DB credentials
5. Set permissions: `chown -R www-data:www-data /var/www/html/crm/uploads`

## Seed Credentials (change immediately after first login)
- Platform Admin: `hulisa.admin` / `Admin@2026x`
- Tenant Admin:   `muga.admin`  / `Admin@2026x`

## Cron Jobs

## SSL
Auto-renewed via certbot. Check with: `certbot certificates`
