# CRM — Multi-Tenant Property Management System

A custom-built property management CRM developed by [Hulisa Business Solutions](https://hulisa.co.za) for property companies in South Africa.

## Features

- **Multi-tenant** — each property company gets their own isolated CRM instance
- **Contacts** — manage tenants, landlords, buyers, and leads grouped by estate/complex
- **Deals** — pipeline tracking from lead to close with commission and fee calculations
- **Listings** — property listings with photo gallery, lightbox, and primary photo
- **Leases** — rental agreements with document uploads, repairs tracking, and expiry alerts
- **Invoices** — one-time and monthly automated invoices with PDF generation and email delivery
- **Landlord & Debtor Statements** — PDF statements with tenant branding
- **FICA Compliance** — track ID Copy, Proof of Address, and Bank Statement per contact
- **Role-Based Access** — Super Admin, Admin, Finance Admin, Agent
- **Agent Management** — agents see only their assigned contacts, deals, and listings
- **Leaderboard** — agent performance rankings
- **Platform Admin** — Hulisa can manage all tenants, impersonate, reset passwords
- **Mobile Responsive** — works on desktop, tablet, and mobile

## Tech Stack

- **Backend** — PHP 8.1, MySQL 8, Apache
- **Frontend** — Vanilla JS (single app.js), CSS custom properties
- **PDF Generation** — Python 3 + ReportLab
- **Email** — PHPMailer + SMTP
- **Auth** — Cookie-based sessions, bcrypt password hashing

## Installation

1. Clone the repo
2. Run `composer install`
3. Create a MySQL database and import `database.sql`
4. Copy `includes/config.example.php` to `includes/config.php` and fill in your credentials
5. Set up Apache to point to the project root
6. Set permissions: `chown -R www-data:www-data uploads/`
7. Install Python dependencies: `pip install reportlab pillow`
8. Set up cron jobs (see DEPLOY.md)

## Requirements

- PHP 8.1+
- MySQL 8+
- Python 3.8+
- Apache with mod_rewrite

## Security

- All passwords hashed with bcrypt (cost 12)
- CSRF protection via session tokens
- Role-based access control on every API endpoint
- XSS protection via HTML escaping
- SQL injection protection via prepared statements
- Security headers (HSTS, X-Frame-Options, X-Content-Type-Options)

## Licence

Private — built exclusively for Hulisa Business Solutions clients.
