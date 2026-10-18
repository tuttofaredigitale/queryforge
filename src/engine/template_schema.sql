-- Database di esempio di QueryForge (sintassi MySQL).
-- Viene tradotto ed eseguito dal motore SQL del browser (src/engine).

-- Tabella clienti
CREATE TABLE clienti (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(50) NOT NULL,
  cognome VARCHAR(50) NOT NULL,
  email VARCHAR(100) UNIQUE,
  telefono VARCHAR(20),
  data_registrazione DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabella categorie
CREATE TABLE categorie (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(50) NOT NULL,
  descrizione TEXT
);

-- Tabella prodotti
CREATE TABLE prodotti (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descrizione TEXT,
  prezzo DECIMAL(10, 2) NOT NULL,
  categoria_id INT,
  disponibilita INT DEFAULT 0,
  FOREIGN KEY (categoria_id) REFERENCES categorie(id) ON DELETE SET NULL
);

-- Tabella ordini
CREATE TABLE ordini (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  data_ordine DATETIME DEFAULT CURRENT_TIMESTAMP,
  stato ENUM('nuovo', 'in elaborazione', 'spedito', 'consegnato', 'annullato') DEFAULT 'nuovo',
  totale DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (cliente_id) REFERENCES clienti(id) ON DELETE CASCADE
);

-- Tabella dettagli ordine
CREATE TABLE dettagli_ordine (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ordine_id INT NOT NULL,
  prodotto_id INT NOT NULL,
  quantita INT NOT NULL,
  prezzo_unitario DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (ordine_id) REFERENCES ordini(id) ON DELETE CASCADE,
  FOREIGN KEY (prodotto_id) REFERENCES prodotti(id) ON DELETE CASCADE
);

-- Inserimento dati di esempio nelle categorie
INSERT INTO categorie (nome, descrizione) VALUES
('Elettronica', 'Prodotti elettronici e accessori'),
('Abbigliamento', 'Capi di abbigliamento e accessori moda'),
('Casa', 'Articoli per la casa e arredamento'),
('Sport', 'Attrezzature e abbigliamento sportivo');

-- Inserimento dati di esempio nei clienti
INSERT INTO clienti (nome, cognome, email, telefono) VALUES
('Mario', 'Rossi', 'mario.rossi@example.com', '3201234567'),
('Anna', 'Bianchi', 'anna.bianchi@example.com', '3487654321'),
('Giuseppe', 'Verdi', 'giuseppe.verdi@example.com', '3331234567'),
('Laura', 'Neri', 'laura.neri@example.com', '3491234567');

-- Inserimento dati di esempio nei prodotti
INSERT INTO prodotti (nome, descrizione, prezzo, categoria_id, disponibilita) VALUES
('Smartphone XYZ', 'Smartphone di ultima generazione', 799.99, 1, 25),
('Laptop Pro', 'Laptop professionale ad alte prestazioni', 1299.99, 1, 10),
('T-shirt Basic', 'T-shirt in cotone 100%', 19.99, 2, 100),
('Jeans Classic', 'Jeans a gamba dritta', 49.99, 2, 50),
('Set Pentole', 'Set di pentole antiaderenti', 89.99, 3, 15),
('Pallone da Calcio', 'Pallone da calcio professionale', 29.99, 4, 30);

-- Inserimento dati di esempio negli ordini
INSERT INTO ordini (cliente_id, stato, totale) VALUES
(1, 'consegnato', 849.98),
(2, 'spedito', 139.98),
(3, 'in elaborazione', 1299.99),
(4, 'nuovo', 119.98);

-- Inserimento dati di esempio nei dettagli ordine
INSERT INTO dettagli_ordine (ordine_id, prodotto_id, quantita, prezzo_unitario) VALUES
(1, 1, 1, 799.99),
(1, 3, 1, 49.99),
(2, 3, 2, 19.99),
(2, 6, 1, 29.99),
(3, 2, 1, 1299.99),
(4, 5, 1, 89.99),
(4, 6, 1, 29.99);