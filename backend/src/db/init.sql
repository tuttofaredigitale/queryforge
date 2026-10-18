-- Creazione del database template
CREATE DATABASE IF NOT EXISTS sql_template;
USE sql_template;

-- Creazione delle tabelle
CREATE TABLE categorie (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(50) NOT NULL,
    descrizione TEXT
);

CREATE TABLE prodotti (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descrizione TEXT,
    prezzo DECIMAL(10, 2) NOT NULL,
    categoria_id INT,
    data_creazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (categoria_id) REFERENCES categorie(id)
);

CREATE TABLE clienti (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(50) NOT NULL,
    cognome VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    telefono VARCHAR(20),
    data_registrazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ordini (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,
    data_ordine TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    stato ENUM('in attesa', 'confermato', 'spedito', 'consegnato', 'annullato') DEFAULT 'in attesa',
    totale DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (cliente_id) REFERENCES clienti(id)
);

CREATE TABLE dettagli_ordine (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ordine_id INT NOT NULL,
    prodotto_id INT NOT NULL,
    quantita INT NOT NULL,
    prezzo_unitario DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (ordine_id) REFERENCES ordini(id),
    FOREIGN KEY (prodotto_id) REFERENCES prodotti(id)
);

-- Inserimento dati di esempio
INSERT INTO categorie (nome, descrizione) VALUES
('Elettronica', 'Prodotti elettronici e accessori'),
('Abbigliamento', 'Capi di abbigliamento e accessori moda'),
('Casa', 'Prodotti per la casa e il giardino'),
('Libri', 'Libri, e-book e audiobook'),
('Sport', 'Articoli sportivi e attrezzature');

INSERT INTO prodotti (nome, descrizione, prezzo, categoria_id) VALUES
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

INSERT INTO clienti (nome, cognome, email, telefono) VALUES
('Mario', 'Rossi', 'mario.rossi@email.com', '3331234567'),
('Giulia', 'Bianchi', 'giulia.bianchi@email.com', '3337654321'),
('Luca', 'Verdi', 'luca.verdi@email.com', '3339876543'),
('Sara', 'Neri', 'sara.neri@email.com', '3332345678'),
('Marco', 'Gialli', 'marco.gialli@email.com', '3335678901');

INSERT INTO ordini (cliente_id, stato, totale) VALUES
(1, 'confermato', 849.98),
(2, 'spedito', 149.97),
(3, 'consegnato', 1299.99),
(4, 'in attesa', 64.98),
(5, 'annullato', 39.99);

INSERT INTO dettagli_ordine (ordine_id, prodotto_id, quantita, prezzo_unitario) VALUES
(1, 1, 1, 799.99),
(1, 5, 1, 49.99),
(2, 3, 2, 19.99),
(2, 10, 1, 19.99),
(3, 2, 1, 1299.99),
(4, 7, 1, 12.99),
(4, 8, 1, 24.99),
(4, 9, 1, 29.99),
(5, 6, 1, 39.99);

-- Creazione di uno stored procedure per reimpostare un database utente
DELIMITER //
CREATE PROCEDURE reset_user_db(IN user_db_name VARCHAR(100))
BEGIN
    SET @drop_stmt = CONCAT('DROP DATABASE IF EXISTS ', user_db_name);
    PREPARE stmt FROM @drop_stmt;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    
    SET @create_stmt = CONCAT('CREATE DATABASE ', user_db_name);
    PREPARE stmt FROM @create_stmt;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    
    SET @use_stmt = CONCAT('USE ', user_db_name);
    PREPARE stmt FROM @use_stmt;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    
    -- Copia le tabelle e i dati dal template
    -- ... (qui verranno eseguite le stesse CREATE TABLE e INSERT del template)
END//
DELIMITER ;

-- Creazione di un utente amministratore per gestire il sistema
CREATE USER IF NOT EXISTS 'admin_user'@'%' IDENTIFIED BY 'admin_password';
GRANT ALL PRIVILEGES ON *.* TO 'admin_user'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;