-- MySQL dump 10.13  Distrib 8.0.46, for Linux (x86_64)
--
-- Host: localhost    Database: crm_db
-- ------------------------------------------------------
-- Server version	8.0.46-0ubuntu0.22.04.3

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `activity_log`
--

DROP TABLE IF EXISTS `activity_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `activity_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` int unsigned NOT NULL,
  `user_id` int unsigned DEFAULT NULL,
  `entity_type` varchar(40) DEFAULT NULL,
  `entity_id` int unsigned DEFAULT NULL,
  `action` varchar(80) NOT NULL,
  `description` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_tenant_entity` (`tenant_id`,`entity_type`,`entity_id`),
  KEY `idx_tenant_time` (`tenant_id`,`created_at`),
  CONSTRAINT `activity_log_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `activity_log_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=758 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `contact_documents`
--

DROP TABLE IF EXISTS `contact_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contact_documents` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` int unsigned NOT NULL,
  `contact_id` int unsigned DEFAULT NULL,
  `doc_type` varchar(60) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_url` varchar(500) NOT NULL,
  `file_size` int unsigned DEFAULT NULL,
  `mime_type` varchar(80) DEFAULT NULL,
  `uploaded_by` int unsigned DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `entity_type` varchar(40) DEFAULT 'contact',
  `entity_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `idx_contact` (`contact_id`),
  CONSTRAINT `contact_documents_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `contact_documents_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `contact_documents_ibfk_3` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `contacts`
--

DROP TABLE IF EXISTS `contacts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contacts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` int unsigned NOT NULL,
  `assigned_to` int unsigned DEFAULT NULL,
  `entity_type` enum('individual','company') DEFAULT 'individual',
  `title` varchar(20) DEFAULT NULL,
  `name` varchar(160) NOT NULL,
  `alt_name` varchar(160) DEFAULT NULL,
  `id_number` varchar(30) DEFAULT NULL,
  `dob` date DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `phone2` varchar(30) DEFAULT NULL,
  `alt_phone` varchar(30) DEFAULT NULL,
  `email` varchar(160) DEFAULT NULL,
  `type` enum('Lead','Tenant','Landlord','Buyer','Seller','Owner','Other') DEFAULT 'Lead',
  `tag` varchar(60) DEFAULT NULL,
  `source` varchar(60) DEFAULT 'Manual',
  `status` enum('active','inactive','archived') DEFAULT 'active',
  `complex` varchar(120) DEFAULT NULL,
  `unit` varchar(30) DEFAULT NULL,
  `street1` varchar(160) DEFAULT NULL,
  `street2` varchar(160) DEFAULT NULL,
  `city` varchar(80) DEFAULT NULL,
  `province` varchar(60) DEFAULT NULL,
  `postal` varchar(10) DEFAULT NULL,
  `erf` varchar(40) DEFAULT NULL,
  `portion` varchar(40) DEFAULT NULL,
  `size` varchar(40) DEFAULT NULL,
  `onsite_name` varchar(120) DEFAULT NULL,
  `onsite_phone` varchar(30) DEFAULT NULL,
  `fica_status` enum('pending','partial','complete','expired') DEFAULT 'pending',
  `fica_notes` text,
  `notes` text,
  `created_by` int unsigned DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  KEY `idx_tenant_type` (`tenant_id`,`type`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_assigned` (`assigned_to`),
  CONSTRAINT `contacts_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `contacts_ibfk_2` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `contacts_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4416 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `deals`
--

DROP TABLE IF EXISTS `deals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deals` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` int unsigned NOT NULL,
  `assigned_to` int unsigned DEFAULT NULL,
  `contact_id` int unsigned DEFAULT NULL,
  `listing_id` int unsigned DEFAULT NULL,
  `title` varchar(200) NOT NULL,
  `stage` enum('lead','qualified','pending','closed','withdrawn') NOT NULL DEFAULT 'lead',
  `value` decimal(14,2) DEFAULT '0.00',
  `commission_pct` decimal(5,2) DEFAULT '0.00',
  `commission_amt` decimal(14,2) DEFAULT '0.00',
  `probability` tinyint unsigned DEFAULT '0',
  `expected_close` date DEFAULT NULL,
  `actual_close` date DEFAULT NULL,
  `lost_reason` varchar(200) DEFAULT NULL,
  `notes` text,
  `created_by` int unsigned DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deal_type` enum('Lease','Sale') DEFAULT 'Lease',
  `rental_value` decimal(12,2) DEFAULT NULL,
  `procurement_fee` decimal(12,2) DEFAULT NULL,
  `admin_fee` decimal(12,2) DEFAULT NULL,
  `management_pct` decimal(5,2) DEFAULT NULL,
  `management_amt` decimal(12,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `contact_id` (`contact_id`),
  KEY `listing_id` (`listing_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_tenant_stage` (`tenant_id`,`stage`),
  KEY `idx_assigned` (`assigned_to`),
  CONSTRAINT `deals_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `deals_ibfk_2` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `deals_ibfk_3` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `deals_ibfk_4` FOREIGN KEY (`listing_id`) REFERENCES `listings` (`id`) ON DELETE SET NULL,
  CONSTRAINT `deals_ibfk_5` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `invoice_customers`
--

DROP TABLE IF EXISTS `invoice_customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice_customers` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` int unsigned NOT NULL,
  `type` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'Tenant',
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `id_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unit` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `invoice_lines`
--

DROP TABLE IF EXISTS `invoice_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice_lines` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` int unsigned NOT NULL,
  `invoice_id` int unsigned NOT NULL,
  `description` varchar(300) NOT NULL,
  `quantity` decimal(8,2) DEFAULT '1.00',
  `unit_price` decimal(12,2) NOT NULL,
  `discount` decimal(12,2) DEFAULT '0.00',
  `subtotal` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `idx_invoice` (`invoice_id`),
  CONSTRAINT `invoice_lines_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `invoice_lines_ibfk_2` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `invoice_schedules`
--

DROP TABLE IF EXISTS `invoice_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice_schedules` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` int unsigned NOT NULL,
  `lease_id` int unsigned NOT NULL,
  `invoice_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Monthly Rental',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `vat_applied` tinyint(1) DEFAULT '0',
  `day_of_month` tinyint DEFAULT '1',
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `last_generated` date DEFAULT NULL,
  `created_by` int unsigned DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_lease` (`lease_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `invoices`
--

DROP TABLE IF EXISTS `invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoices` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` int unsigned NOT NULL,
  `ref` varchar(30) NOT NULL,
  `lease_id` int unsigned DEFAULT NULL,
  `contact_id` int unsigned DEFAULT NULL,
  `tenant_name` varchar(160) NOT NULL,
  `subtotal` decimal(12,2) NOT NULL DEFAULT '0.00',
  `discount` decimal(12,2) DEFAULT '0.00',
  `vat_applied` tinyint(1) DEFAULT '0',
  `vat_amount` decimal(12,2) DEFAULT '0.00',
  `total` decimal(12,2) NOT NULL DEFAULT '0.00',
  `due_date` date NOT NULL,
  `paid_date` date DEFAULT NULL,
  `status` enum('unpaid','paid','overdue','cancelled') DEFAULT 'unpaid',
  `notes` text,
  `pdf_url` varchar(500) DEFAULT NULL,
  `created_by` int unsigned DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `invoice_type` varchar(50) DEFAULT 'Monthly Rental',
  PRIMARY KEY (`id`),
  KEY `lease_id` (`lease_id`),
  KEY `contact_id` (`contact_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_tenant_ref` (`tenant_id`,`ref`),
  CONSTRAINT `invoices_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `invoices_ibfk_2` FOREIGN KEY (`lease_id`) REFERENCES `leases` (`id`) ON DELETE SET NULL,
  CONSTRAINT `invoices_ibfk_3` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `invoices_ibfk_4` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lease_repairs`
--

DROP TABLE IF EXISTS `lease_repairs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lease_repairs` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` int unsigned NOT NULL,
  `lease_id` int unsigned NOT NULL,
  `description` varchar(300) NOT NULL,
  `cost` decimal(10,2) DEFAULT '0.00',
  `repair_date` date DEFAULT NULL,
  `status` enum('pending','in_progress','completed') DEFAULT 'pending',
  `notes` text,
  `created_by` int unsigned DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `idx_lease` (`lease_id`),
  CONSTRAINT `lease_repairs_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lease_repairs_ibfk_2` FOREIGN KEY (`lease_id`) REFERENCES `leases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leases`
--

DROP TABLE IF EXISTS `leases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leases` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` int unsigned NOT NULL,
  `ref` varchar(30) NOT NULL,
  `listing_id` int unsigned DEFAULT NULL,
  `contact_id` int unsigned DEFAULT NULL,
  `tenant_name` varchar(160) NOT NULL,
  `landlord_name` varchar(160) DEFAULT NULL,
  `landlord_id` int unsigned DEFAULT NULL,
  `property` varchar(300) DEFAULT NULL,
  `unit` varchar(30) DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `monthly_rent` decimal(12,2) NOT NULL,
  `deposit` decimal(12,2) DEFAULT '0.00',
  `escalation_pct` decimal(5,2) DEFAULT '0.00',
  `status` enum('active','expired','cancelled','pending') DEFAULT 'pending',
  `notes` text,
  `lease_doc_url` varchar(500) DEFAULT NULL,
  `lease_doc_name` varchar(255) DEFAULT NULL,
  `created_by` int unsigned DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `assigned_to` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `listing_id` (`listing_id`),
  KEY `contact_id` (`contact_id`),
  KEY `landlord_id` (`landlord_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  CONSTRAINT `leases_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `leases_ibfk_2` FOREIGN KEY (`listing_id`) REFERENCES `listings` (`id`) ON DELETE SET NULL,
  CONSTRAINT `leases_ibfk_3` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `leases_ibfk_4` FOREIGN KEY (`landlord_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `leases_ibfk_5` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `listing_photos`
--

DROP TABLE IF EXISTS `listing_photos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `listing_photos` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` int unsigned NOT NULL,
  `listing_id` int unsigned NOT NULL,
  `file_url` varchar(500) NOT NULL,
  `thumb_url` varchar(500) DEFAULT NULL,
  `caption` varchar(200) DEFAULT NULL,
  `sort_order` tinyint unsigned DEFAULT '0',
  `is_primary` tinyint(1) DEFAULT '0',
  `uploaded_by` int unsigned DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `idx_listing` (`listing_id`),
  CONSTRAINT `listing_photos_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `listing_photos_ibfk_2` FOREIGN KEY (`listing_id`) REFERENCES `listings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `listing_photos_ibfk_3` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `listings`
--

DROP TABLE IF EXISTS `listings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `listings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` int unsigned NOT NULL,
  `assigned_to` int unsigned DEFAULT NULL,
  `ref` varchar(30) NOT NULL,
  `title` varchar(200) NOT NULL,
  `type` enum('Residential','Commercial','Industrial','Land','Mixed Use') DEFAULT 'Residential',
  `listing_type` enum('Sale','Rent','Both') DEFAULT 'Sale',
  `status` enum('Active','Under Offer','Sold','Rented','Withdrawn') DEFAULT 'Active',
  `price` decimal(14,2) DEFAULT NULL,
  `rental_price` decimal(14,2) DEFAULT NULL,
  `address` varchar(300) DEFAULT NULL,
  `complex` varchar(120) DEFAULT NULL,
  `unit` varchar(30) DEFAULT NULL,
  `city` varchar(80) DEFAULT NULL,
  `province` varchar(60) DEFAULT NULL,
  `postal` varchar(10) DEFAULT NULL,
  `bedrooms` tinyint unsigned DEFAULT NULL,
  `bathrooms` tinyint unsigned DEFAULT NULL,
  `garages` tinyint unsigned DEFAULT NULL,
  `erf_size` varchar(40) DEFAULT NULL,
  `floor_size` varchar(40) DEFAULT NULL,
  `description` text,
  `features` text,
  `owner_id` int unsigned DEFAULT NULL,
  `contact_id` int unsigned DEFAULT NULL,
  `owner_name` varchar(160) DEFAULT NULL,
  `mandate_type` enum('Sole','Joint','Open') DEFAULT 'Sole',
  `mandate_expiry` date DEFAULT NULL,
  `listed_date` date DEFAULT NULL,
  `sold_date` date DEFAULT NULL,
  `created_by` int unsigned DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `primary_photo` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `assigned_to` (`assigned_to`),
  KEY `owner_id` (`owner_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_tenant_type` (`tenant_id`,`type`),
  KEY `contact_id` (`contact_id`),
  CONSTRAINT `listings_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `listings_ibfk_2` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `listings_ibfk_3` FOREIGN KEY (`owner_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `listings_ibfk_4` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `listings_ibfk_5` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `login_attempts`
--

DROP TABLE IF EXISTS `login_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `login_attempts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attempted_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `success` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` int unsigned NOT NULL,
  `user_id` int unsigned DEFAULT NULL,
  `type` varchar(40) DEFAULT NULL,
  `message` varchar(300) NOT NULL,
  `entity_type` varchar(40) DEFAULT NULL,
  `entity_id` int unsigned DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `title` varchar(200) DEFAULT NULL,
  `body` text,
  `assigned_to` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_read` (`user_id`,`is_read`),
  KEY `idx_tenant` (`tenant_id`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notifications_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` int unsigned NOT NULL,
  `name` varchar(200) NOT NULL,
  `description` text,
  `price` decimal(12,2) DEFAULT '0.00',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`),
  CONSTRAINT `products_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `token` varchar(128) NOT NULL,
  `user_id` int unsigned NOT NULL,
  `tenant_id` int unsigned DEFAULT NULL,
  `role` varchar(30) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(300) DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `impersonating_from` varchar(128) DEFAULT NULL,
  PRIMARY KEY (`token`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tenant_settings`
--

DROP TABLE IF EXISTS `tenant_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tenant_settings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` int unsigned NOT NULL,
  `setting_key` varchar(80) NOT NULL,
  `setting_value` text,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant_key` (`tenant_id`,`setting_key`),
  CONSTRAINT `tenant_settings_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=55 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tenants`
--

DROP TABLE IF EXISTS `tenants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tenants` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `slug` varchar(60) NOT NULL,
  `email` varchar(160) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `address` text,
  `logo_url` varchar(500) DEFAULT NULL,
  `primary_colour` varchar(10) DEFAULT '#1a1917',
  `status` enum('active','suspended','trial') DEFAULT 'trial',
  `plan` enum('starter','professional','enterprise') DEFAULT 'starter',
  `bank_company` varchar(120) DEFAULT NULL,
  `bank_name` varchar(80) DEFAULT NULL,
  `bank_account` varchar(40) DEFAULT NULL,
  `bank_type` varchar(40) DEFAULT NULL,
  `bank_branch` varchar(20) DEFAULT NULL,
  `bank_swift` varchar(20) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` int unsigned DEFAULT NULL,
  `name` varchar(120) NOT NULL,
  `email` varchar(160) NOT NULL,
  `username` varchar(80) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('platform_superadmin','super_admin','admin','finance_admin','agent') NOT NULL DEFAULT 'agent',
  `avatar_url` varchar(500) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `last_login` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_email` (`email`),
  UNIQUE KEY `uq_username` (`username`),
  KEY `tenant_id` (`tenant_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping routines for database 'crm_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-26 10:58:41
