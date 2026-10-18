--
-- Creazione delle tabelle (senza Foreign Keys)
--
CREATE TABLE `categorie` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(50) NOT NULL,
  `descrizione` text,
  PRIMARY KEY (`id`)
);

CREATE TABLE `prodotti` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(100) NOT NULL,
  `descrizione` text,
  `prezzo` decimal(10,2) NOT NULL,
  `categoria_id` int DEFAULT NULL,
  `data_creazione` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

CREATE TABLE `clienti` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(50) NOT NULL,
  `cognome` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `data_registrazione` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
);

CREATE TABLE `ordini` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cliente_id` int NOT NULL,
  `data_ordine` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `stato` enum('in attesa','confermato','spedito','consegnato','annullato') DEFAULT 'in attesa',
  `totale` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE `dettagli_ordine` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ordine_id` int NOT NULL,
  `prodotto_id` int NOT NULL,
  `quantita` int NOT NULL,
  `prezzo_unitario` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`)
);

--
-- Inserimento dati di esempio (invariato)
--
INSERT INTO `categorie` (nome, descrizione) VALUES
('Elettronica', 'Prodotti elettronici e accessori'),
('Abbigliamento', 'Capi di abbigliamento e accessori moda'),
('Casa', 'Prodotti per la casa e il giardino'),
('Libri', 'Libri, e-book e audiobook'),
('Sport', 'Articoli sportivi e attrezzature');

INSERT INTO `prodotti` (nome, descrizione, prezzo, categoria_id) VALUES
('Smartphone XYZ', 'Smartphone di ultima generazione', 799.99, 1),
('Laptop Pro', 'Laptop per uso professionale', 1299.99, 1),
('T-shirt Basic', 'T-shirt in cotone 100%', 19.99, 2),
('Jeans Classic', 'Jeans dal taglio classico', 49.99, 2),
('Set Pentole', 'Set di pentole antiaderenti', 129.99, 3),
('Lampada LED', 'Lampada da tavolo a LED', 39.99, 3),
('Il Nome della Rosa', 'Romanzo di Umberto Eco', 12.99, 4),
('Storia della Filosofia', 'Manuale di filosofia', 24.99, 4),
('Pallone da Calcio', 'Pallone da calcio professionale', 29.99, 5),
('Tappetino Yoga', 'Tappetino antiscivolo per yoga', 19.99, 5);

INSERT INTO `clienti` (nome, cognome, email, telefono) VALUES
('Mario', 'Rossi', 'mario.rossi@email.com', '3331234567'),
('Giulia', 'Bianchi', 'giulia.bianchi@email.com', '3337654321'),
('Luca', 'Verdi', 'luca.verdi@email.com', '3339876543'),
('Sara', 'Neri', 'sara.neri@email.com', '3332345678'),
('Marco', 'Gialli', 'marco.gialli@email.com', '3335678901');

INSERT INTO `ordini` (cliente_id, stato, totale) VALUES
(1, 'confermato', 849.98),
(2, 'spedito', 149.97),
(3, 'consegnato', 1299.99),
(4, 'in attesa', 64.98),
(5, 'annullato', 39.99);

INSERT INTO `dettagli_ordine` (ordine_id, prodotto_id, quantita, prezzo_unitario) VALUES
(1, 1, 1, 799.99),
(1, 5, 1, 49.99),
(2, 3, 2, 19.99),
(2, 10, 1, 19.99),
(3, 2, 1, 1299.99),
(4, 7, 1, 12.99),
(4, 8, 1, 24.99),
(4, 9, 1, 29.99),
(5, 6, 1, 39.99);
