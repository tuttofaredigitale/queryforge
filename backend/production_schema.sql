-- =====================================================================
-- Schema Definitivo e Idempotente per PlanetScale
-- =====================================================================

-- Parte 1: CANCELLA le tabelle esistenti per garantire una partenza pulita
-- L'ordine è importante per via delle relazioni logiche.
DROP TABLE IF EXISTS `ai_prompt_usage`;
DROP TABLE IF EXISTS `billing_history`;
DROP TABLE IF EXISTS `query_history`;
DROP TABLE IF EXISTS `query_usage`;
DROP TABLE IF EXISTS `refresh_tokens`;
DROP TABLE IF EXISTS `saved_queries`;
DROP TABLE IF EXISTS `user_backups`;
DROP TABLE IF EXISTS `users`;

-- Parte 2: CREA le tabelle con la struttura corretta

--
-- Struttura della tabella `users`
--
CREATE TABLE `users` (
  `id` int NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `username` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `role` varchar(20) NOT NULL DEFAULT 'user',
  `terms_accepted` tinyint(1) DEFAULT '0',
  `terms_accepted_date` datetime DEFAULT NULL,
  `privacy_policy_accepted` tinyint(1) DEFAULT '0',
  `privacy_policy_accepted_date` datetime DEFAULT NULL,
  `reset_token` varchar(255) DEFAULT NULL,
  `reset_token_expiry` datetime DEFAULT NULL,
  `last_logout` datetime DEFAULT NULL,
  `plan` enum('free','pro') NOT NULL DEFAULT 'free',
  `plan_start_date` datetime DEFAULT NULL,
  `plan_end_date` datetime DEFAULT NULL,
  `lemonsqueezy_customer_id` varchar(255) DEFAULT NULL,
  `lemonsqueezy_subscription_id` varchar(255) DEFAULT NULL,
  `subscription_status` varchar(50) DEFAULT NULL,
  `plan_type` varchar(255) DEFAULT NULL,
  `subscription_end_date` datetime DEFAULT NULL
);

--
-- Struttura della tabella `ai_prompt_usage`
--
CREATE TABLE `ai_prompt_usage` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `usage_month` date NOT NULL,
  `count` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

--
-- Struttura della tabella `billing_history`
--
CREATE TABLE `billing_history` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `lemonsqueezy_order_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `order_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `currency` varchar(3) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subtotal` int DEFAULT NULL,
  `tax` int DEFAULT NULL,
  `discount` int DEFAULT NULL,
  `total` int DEFAULT NULL,
  `receipt_url` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

--
-- Struttura della tabella `query_history`
--
CREATE TABLE `query_history` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `query` text NOT NULL,
  `executed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `error` text
);

--
-- Struttura della tabella `query_usage`
--
CREATE TABLE `query_usage` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `usage_date` date NOT NULL,
  `count` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

--
-- Struttura della tabella `refresh_tokens`
--
CREATE TABLE `refresh_tokens` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `is_revoked` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `device_info` json DEFAULT NULL
);

--
-- Struttura della tabella `saved_queries`
--
CREATE TABLE `saved_queries` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `query` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
);

--
-- Struttura della tabella `user_backups`
--
CREATE TABLE `user_backups` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `backup_name` varchar(255) DEFAULT NULL,
  `backup_type` enum('scheduled','manual') NOT NULL,
  `backup_size` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('pending','completed','failed') DEFAULT 'pending',
  `file_path` varchar(512) DEFAULT NULL,
  `retention_until` timestamp NULL DEFAULT NULL,
  `metadata` json DEFAULT NULL
);

--
-- Parte 3: Aggiunge Indici e AUTO_INCREMENT
--
ALTER TABLE `users` ADD PRIMARY KEY (`id`), ADD UNIQUE KEY `email` (`email`), ADD KEY `idx_terms_accepted` (`terms_accepted`), ADD KEY `idx_reset_token` (`reset_token`);
ALTER TABLE `ai_prompt_usage` ADD PRIMARY KEY (`id`), ADD UNIQUE KEY `unique_user_month` (`user_id`,`usage_month`);
ALTER TABLE `billing_history` ADD PRIMARY KEY (`id`), ADD UNIQUE KEY `lemonsqueezy_order_id` (`lemonsqueezy_order_id`), ADD KEY `idx_user_id` (`user_id`), ADD KEY `idx_order_id` (`lemonsqueezy_order_id`);
ALTER TABLE `query_history` ADD PRIMARY KEY (`id`), ADD KEY `user_id` (`user_id`);
ALTER TABLE `query_usage` ADD PRIMARY KEY (`id`), ADD UNIQUE KEY `user_date_unique` (`user_id`,`usage_date`), ADD UNIQUE KEY `unique_user_date` (`user_id`,`usage_date`);
ALTER TABLE `refresh_tokens` ADD PRIMARY KEY (`id`), ADD KEY `user_id` (`user_id`);
ALTER TABLE `saved_queries` ADD PRIMARY KEY (`id`), ADD KEY `user_id` (`user_id`);
ALTER TABLE `user_backups` ADD PRIMARY KEY (`id`), ADD KEY `user_id` (`user_id`);

ALTER TABLE `users` MODIFY `id` int NOT NULL AUTO_INCREMENT;
ALTER TABLE `ai_prompt_usage` MODIFY `id` int NOT NULL AUTO_INCREMENT;
ALTER TABLE `billing_history` MODIFY `id` int NOT NULL AUTO_INCREMENT;
ALTER TABLE `query_history` MODIFY `id` int NOT NULL AUTO_INCREMENT;
ALTER TABLE `query_usage` MODIFY `id` int NOT NULL AUTO_INCREMENT;
ALTER TABLE `refresh_tokens` MODIFY `id` int NOT NULL AUTO_INCREMENT;
ALTER TABLE `saved_queries` MODIFY `id` int NOT NULL AUTO_INCREMENT;
ALTER TABLE `user_backups` MODIFY `id` int NOT NULL AUTO_INCREMENT;