# Muga CRM Test Skill

## Purpose
Run comprehensive system tests on the Muga Properties CRM (PHP/MySQL).

## Stack
- Backend: PHP 8.1 / MySQL 8
- Server: Apache on Ubuntu 22 (Afrihost VPS)
- Path: /var/www/html/crm

## Test Categories

### 1. Functional Testing
- Test login flow for all user roles (admin, agent, landlord)
- Test RBAC — verify each role sees only permitted modules
- Test contact creation, editing, deletion
- Test invoice generation and PDF output
- Test lease creation and expiry warnings

### 2. E2E Testing
- Full journey: login → create contact → create listing → create lease → generate invoice
- Full journey: login → create landlord → link property → assign tenant

### 3. Negative Testing
- Attempt login with wrong credentials — expect rejection
- Attempt to access admin routes as agent — expect 403
- Submit empty required fields — expect validation errors
- Submit SQL injection strings in input fields — expect safe handling

### 4. Security Testing
- Check session handling after logout
- Check for exposed API endpoints without auth
- Check SMTP credentials are not exposed in responses

### 5. Regression Testing
- After any code change, re-run all functional tests
- Verify existing data is not corrupted

## How to Run
1. Use PHPUnit for API and logic tests
2. Use Playwright for browser-based E2E tests
3. Log results to /var/www/html/crm/tests/results/

