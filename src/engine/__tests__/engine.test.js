import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import initSqlJs from 'sql.js';
import template from '../template_schema.sql?raw';
import exercises from '../../data/sql_exercises.json';
import { Engine } from '../engine.js';

let SQL;
let engine;

const run = (sql) => engine.execute(sql);
const rows = (sql) => run(sql).rows;
const value = (sql) => {
  const r = run(sql);
  return r.rows[0][r.columns[0]];
};
const errorOf = (sql) => {
  try {
    run(sql);
  } catch (e) {
    return e.message;
  }
  throw new Error(`La query non ha dato errore: ${sql}`);
};

beforeAll(async () => {
  SQL = await initSqlJs();
});

beforeEach(() => {
  engine = Engine.fromScript(SQL, template);
});

describe('database di esempio', () => {
  it('crea le cinque tabelle con i dati', () => {
    expect(rows('SHOW TABLES').map((r) => r.Tables_in_queryforge)).toEqual(['categorie', 'clienti', 'dettagli_ordine', 'ordini', 'prodotti']);
    expect(value('SELECT COUNT(*) FROM prodotti')).toBe(6);
    expect(value('SELECT COUNT(*) FROM dettagli_ordine')).toBe(7);
  });

  it('descrive le colonne come MySQL', () => {
    const cols = rows('DESCRIBE ordini');
    expect(cols[0]).toMatchObject({ Field: 'id', Type: 'int', Null: 'NO', Key: 'PRI', Extra: 'auto_increment' });
    expect(cols.find((c) => c.Field === 'stato').Type).toBe("enum('nuovo','in elaborazione','spedito','consegnato','annullato')");
    expect(cols.find((c) => c.Field === 'cliente_id').Key).toBe('MUL');
    expect(cols.find((c) => c.Field === 'totale').Type).toBe('decimal(10,2)');
    expect(cols.find((c) => c.Field === 'data_ordine').Default).toBe('CURRENT_TIMESTAMP');
  });

  it('fornisce la struttura per la barra laterale', () => {
    const structure = engine.structure();
    const clienti = structure.find((t) => t.name === 'clienti');
    expect(clienti.columns.map((c) => c.name)).toEqual(['id', 'nome', 'cognome', 'email', 'telefono', 'data_registrazione']);
    expect(clienti.columns.find((c) => c.name === 'email').key).toBe('UNI');
  });
});

describe('soluzioni degli esercizi', () => {
  const expected = {
    101: 4, 102: 4, 103: 4, 104: 1, 201: 3, 202: 1, 203: 6, 301: 2, 302: 2, 303: 1, 304: 0, 305: 4, 306: 0,
    401: 1, 402: 1, 403: 4, 404: 1, 405: 1, 406: 4, 501: 4, 502: 7, 503: 4, 504: 4, 505: 1, 506: 7,
    601: 2, 602: 4, 603: 0, 604: 1, 605: 6, 606: 2
  };
  for (const chapter of exercises) {
    for (const lesson of chapter.lessons) {
      it(`${lesson.id} ${lesson.title}`, () => {
        const result = run(lesson.solution);
        expect(result.rows.length).toBe(expected[lesson.id]);
      });
    }
  }

  it('usa gli stessi nomi di colonna di MySQL', () => {
    expect(run('SELECT AVG(prezzo) FROM prodotti;').columns).toEqual(['AVG(prezzo)']);
    expect(value('SELECT AVG(prezzo) FROM prodotti')).toBe(381.656666666667);
    expect(rows('SELECT MIN(prezzo) AS prezzo_min, MAX(prezzo) AS prezzo_max FROM prodotti')[0]).toEqual({ prezzo_min: 19.99, prezzo_max: 1299.99 });
    expect(run('SELECT stato, SUM(totale) FROM ordini GROUP BY stato').columns).toEqual(['stato', 'SUM(totale)']);
  });
});

describe('funzioni e sintassi MySQL', () => {
  it('divisione decimale e DIV', () => {
    const r = run('SELECT 5/2, 7 DIV 2');
    expect(r.columns).toEqual(['5/2', '7 DIV 2']);
    expect(Object.values(r.rows[0])).toEqual([2.5, 3]);
  });

  it('stringhe', () => {
    expect(value("SELECT CONCAT('a', NULL)")).toBeNull();
    expect(value("SELECT CONCAT(nome, ' ', cognome) FROM clienti WHERE id = 1")).toBe('Mario Rossi');
    expect(Object.values(rows("SELECT LENGTH('è'), CHAR_LENGTH('è')")[0])).toEqual([2, 1]);
    expect(Object.values(rows("SELECT LEFT('Mario', 3), RIGHT('Mario', 2), SUBSTRING('Mario', 2, 3), SUBSTRING('Mario' FROM 2 FOR 2)")[0])).toEqual(['Mar', 'io', 'ari', 'ar']);
    expect(Object.values(rows("SELECT LOCATE('r', 'Mario'), POSITION('R' IN 'Mario'), INSTR('Mario', 'io')")[0])).toEqual([3, 3, 4]);
    expect(Object.values(rows("SELECT LPAD('5', 3, '0'), RPAD('ab', 4, '-'), TRIM(LEADING 'x' FROM 'xxabc'), TRIM('  a  ')")[0])).toEqual(['005', 'ab--', 'abc', 'a']);
    expect(value("SELECT UPPER('perché')")).toBe('PERCHÉ');
    expect(value("SELECT SUBSTRING_INDEX('www.example.com', '.', 2)")).toBe('www.example');
    expect(value("SELECT REPLACE('aaa', 'a', 'b')")).toBe('bbb');
    expect(value("SELECT FORMAT(1234567.891, 2)")).toBe('1,234,567.89');
    expect(value("SELECT 'It\\'s'")).toBe("It's");
    expect(value('SELECT "doppi apici"')).toBe('doppi apici');
    expect(run("SELECT 'ciao'").columns).toEqual(['ciao']);
  });

  it('confronti senza distinzione tra maiuscole e minuscole', () => {
    expect(rows("SELECT * FROM clienti WHERE nome = 'mario'").length).toBe(1);
    expect(rows("SELECT * FROM clienti WHERE nome LIKE 'MAR%'").length).toBe(1);
    expect(rows("SELECT nome FROM clienti WHERE nome REGEXP '^m'")).toEqual([{ nome: 'Mario' }]);
    expect(value('SELECT 1 <=> NULL')).toBe(0);
    expect(value('SELECT NULL <=> NULL')).toBe(1);
  });

  it('numeri', () => {
    expect(Object.values(rows('SELECT ROUND(2.5), ROUND(1.005, 2), TRUNCATE(1.789, 1), MOD(7, 3), POW(2, 10), CEIL(1.2), FLOOR(1.8)')[0])).toEqual([3, 1.01, 1.7, 1, 1024, 2, 1]);
    expect(Object.values(rows("SELECT CAST('12.567' AS DECIMAL(10,2)), CAST('42abc' AS SIGNED), CAST(3.7 AS SIGNED), CAST(19.99 AS CHAR)")[0])).toEqual([12.57, 42, 4, '19.99']);
    expect(value('SELECT GREATEST(3, 9, 1)')).toBe(9);
    expect(value('SELECT SUM(totale) FROM ordini')).toBe(2409.93);
  });

  it('date', () => {
    expect(value("SELECT DATE_FORMAT('2024-03-05 14:07:09', '%d/%m/%Y %H:%i')")).toBe('05/03/2024 14:07');
    expect(value("SELECT DATE_FORMAT('2024-03-05', '%W %D %M %Y')")).toBe('Tuesday 5th March 2024');
    expect(value("SELECT DATE_ADD('2024-01-31', INTERVAL 1 MONTH)")).toBe('2024-02-29');
    expect(value("SELECT DATE_SUB('2024-03-01 10:00:00', INTERVAL 90 MINUTE)")).toBe('2024-03-01 08:30:00');
    expect(value("SELECT '2024-01-01' + INTERVAL 10 DAY")).toBe('2024-01-11');
    expect(value("SELECT DATEDIFF('2024-03-01', '2024-02-01')")).toBe(29);
    expect(value("SELECT TIMESTAMPDIFF(MONTH, '2024-01-31', '2024-03-30')")).toBe(1);
    expect(value("SELECT TIMESTAMPDIFF(DAY, '2024-01-01', '2024-01-31')")).toBe(30);
    expect(Object.values(rows("SELECT YEAR('2024-05-06'), MONTH('2024-05-06'), DAY('2024-05-06'), DAYNAME('2024-05-06'), MONTHNAME('2024-05-06')")[0])).toEqual([2024, 5, 6, 'Monday', 'May']);
    expect(value("SELECT EXTRACT(YEAR FROM '2024-05-06')")).toBe(2024);
    expect(value("SELECT LAST_DAY('2024-02-10')")).toBe('2024-02-29');
    expect(value("SELECT STR_TO_DATE('05/03/2024', '%d/%m/%Y')")).toBe('2024-03-05');
    expect(value('SELECT NOW()')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(value('SELECT CURRENT_DATE')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(value("SELECT DATE '2024-01-31'")).toBe('2024-01-31');
  });

  it('settimane come negli esempi della documentazione MySQL', () => {
    expect(value("SELECT WEEK('2008-02-20')")).toBe(7);
    expect(value("SELECT WEEK('2008-02-20', 1)")).toBe(8);
    expect(value("SELECT WEEK('2008-12-31', 1)")).toBe(53);
    expect(value("SELECT WEEK('2000-01-01', 2)")).toBe(52);
    expect(value("SELECT YEARWEEK('1987-01-01')")).toBe(198652);
    expect(value("SELECT WEEKOFYEAR('2008-02-20')")).toBe(8);
  });

  it('aggregazioni e GROUP_CONCAT', () => {
    expect(value("SELECT GROUP_CONCAT(nome ORDER BY nome SEPARATOR ', ') FROM categorie")).toBe('Abbigliamento, Casa, Elettronica, Sport');
    expect(value('SELECT GROUP_CONCAT(DISTINCT categoria_id ORDER BY categoria_id) FROM prodotti')).toBe('1,2,3,4');
    expect(value('SELECT COUNT(*) totale FROM clienti')).toBe(4);
    expect(run('SELECT COUNT(*) totale FROM clienti').columns).toEqual(['totale']);
    expect(value('SELECT STDDEV_POP(quantita) FROM dettagli_ordine')).toBeCloseTo(0.3499, 3);
  });

  it('subquery con ANY e ALL', () => {
    expect(rows('SELECT * FROM prodotti WHERE prezzo > ANY (SELECT prezzo FROM prodotti WHERE categoria_id = 2)').length).toBe(5);
    expect(rows('SELECT nome FROM prodotti WHERE prezzo >= ALL (SELECT prezzo FROM prodotti)')).toEqual([{ nome: 'Laptop Pro' }]);
    expect(rows('SELECT nome FROM prodotti p WHERE prezzo >= ALL (SELECT prezzo FROM prodotti WHERE categoria_id = p.categoria_id) ORDER BY nome').map((r) => r.nome)).toEqual(['Jeans Classic', 'Laptop Pro', 'Pallone da Calcio', 'Set Pentole']);
  });

  it('LIMIT con offset, DUAL, commenti e nomi duplicati', () => {
    expect(rows('SELECT id FROM clienti ORDER BY id LIMIT 1, 2')).toEqual([{ id: 2 }, { id: 3 }]);
    expect(value("SELECT 'x' FROM DUAL")).toBe('x');
    expect(value('SELECT 1 -- commento\n# altro commento\n')).toBe(1);
    expect(run('SELECT c.nome, p.nome FROM clienti c, prodotti p LIMIT 1').columns).toEqual(['nome', 'nome (2)']);
  });

  it('hash e informazioni', () => {
    expect(value("SELECT MD5('ciao')")).toBe(createHash('md5').update('ciao').digest('hex'));
    expect(value("SELECT SHA1('ciao')")).toBe(createHash('sha1').update('ciao').digest('hex'));
    expect(value("SELECT SHA2('ciao', 256)")).toBe(createHash('sha256').update('ciao').digest('hex'));
    expect(value('SELECT DATABASE()')).toBe('queryforge');
    expect(value('SELECT VERSION()')).toContain('SQLite');
  });

  it('un errore di battitura nel nome di colonna resta un errore', () => {
    expect(errorOf('SELECT `nmoe` FROM clienti')).toContain("La colonna 'nmoe' non esiste");
    expect(errorOf('SELECT * FROM clientii')).toContain("La tabella 'clientii' non esiste");
  });
});

describe('modifica dei dati', () => {
  it('INSERT con colonne, SET, DEFAULT e IGNORE', () => {
    let r = run("INSERT INTO categorie (nome, descrizione) VALUES ('Libri', 'Carta')");
    expect(r).toMatchObject({ affectedRows: 1, insertId: 5 });
    r = run("INSERT INTO categorie SET nome = 'Musica', descrizione = 'CD'");
    expect(r.insertId).toBe(6);
    r = run("INSERT INTO categorie VALUES (DEFAULT, 'Giochi', NULL)");
    expect(r.insertId).toBe(7);
    r = run("INSERT IGNORE INTO clienti (nome, cognome, email) VALUES ('X', 'Y', 'mario.rossi@example.com')");
    expect(r.affectedRows).toBe(0);
  });

  it('INSERT ... ON DUPLICATE KEY UPDATE', () => {
    run('CREATE TABLE magazzino (prodotto_id INT PRIMARY KEY, quantita INT NOT NULL)');
    run('INSERT INTO magazzino VALUES (1, 5)');
    run('INSERT INTO magazzino (prodotto_id, quantita) VALUES (1, 3) ON DUPLICATE KEY UPDATE quantita = quantita + VALUES(quantita)');
    expect(value('SELECT quantita FROM magazzino WHERE prodotto_id = 1')).toBe(8);
  });

  it('UPDATE e DELETE con ORDER BY e LIMIT', () => {
    expect(run('UPDATE prodotti SET prezzo = prezzo * 2 ORDER BY prezzo DESC LIMIT 1').affectedRows).toBe(1);
    expect(value("SELECT prezzo FROM prodotti WHERE nome = 'Laptop Pro'")).toBe(2599.98);
    expect(run('DELETE FROM dettagli_ordine ORDER BY id DESC LIMIT 2').affectedRows).toBe(2);
    expect(value('SELECT COUNT(*) FROM dettagli_ordine')).toBe(5);
  });

  it('UPDATE con JOIN', () => {
    const r = run("UPDATE ordini o JOIN clienti c ON o.cliente_id = c.id SET o.totale = o.totale + 1 WHERE c.nome = 'Mario'");
    expect(r.affectedRows).toBe(1);
    expect(value('SELECT totale FROM ordini WHERE id = 1')).toBe(850.98);
  });

  it('DELETE con JOIN e cancellazione a cascata', () => {
    run("DELETE o FROM ordini o JOIN clienti c ON o.cliente_id = c.id WHERE c.nome = 'Mario'");
    expect(value('SELECT COUNT(*) FROM ordini')).toBe(3);
    expect(value('SELECT COUNT(*) FROM dettagli_ordine')).toBe(5);
  });

  it('vincoli: ENUM, chiave esterna, NOT NULL', () => {
    expect(errorOf("UPDATE ordini SET stato = 'perso' WHERE id = 1")).toContain('Valore non ammesso');
    expect(errorOf('INSERT INTO ordini (cliente_id, totale) VALUES (99, 10)')).toContain('chiave esterna');
    expect(errorOf("INSERT INTO prodotti (nome) VALUES ('Senza prezzo')")).toContain("'prodotti.prezzo' non può essere vuota");
  });

  it('transazioni', () => {
    run('START TRANSACTION');
    run('DELETE FROM dettagli_ordine');
    expect(engine.inTransaction()).toBe(true);
    run('ROLLBACK');
    expect(engine.inTransaction()).toBe(false);
    expect(value('SELECT COUNT(*) FROM dettagli_ordine')).toBe(7);
    expect(run('COMMIT').message).toContain('COMMIT');
  });

  it('TRUNCATE e DROP rispettano le chiavi esterne come MySQL', () => {
    expect(errorOf('TRUNCATE TABLE ordini')).toContain('dettagli_ordine');
    run('TRUNCATE dettagli_ordine');
    expect(value('SELECT COUNT(*) FROM dettagli_ordine')).toBe(0);
    expect(errorOf('DROP TABLE clienti')).toContain('ordini');
    run('SET FOREIGN_KEY_CHECKS = 0');
    run('DROP TABLE clienti');
    run('SET FOREIGN_KEY_CHECKS = 1');
    expect(rows('SHOW TABLES').length).toBe(4);
  });

  it('più istruzioni insieme', () => {
    const r = run("INSERT INTO categorie (nome) VALUES ('Auto'); SELECT nome FROM categorie WHERE nome = 'Auto';");
    expect(r.rows).toEqual([{ nome: 'Auto' }]);
    expect(r.statements).toBe(2);
    expect(errorOf('SELECT 1; SELECT * FROM nessuna')).toContain("istruzione 2 di 2");
  });
});

describe('struttura delle tabelle', () => {
  const createSql = `
    CREATE TABLE IF NOT EXISTS recensioni (
      id INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
      prodotto_id INT NOT NULL,
      voto TINYINT NOT NULL CHECK (voto BETWEEN 1 AND 5),
      titolo VARCHAR(100) NOT NULL DEFAULT '' COMMENT 'titolo breve',
      stato ENUM('bozza', 'pubblicata') NOT NULL DEFAULT 'bozza',
      creata_il DATETIME DEFAULT CURRENT_TIMESTAMP,
      aggiornata_il TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_titolo (titolo),
      KEY idx_prodotto (prodotto_id),
      CONSTRAINT fk_recensioni_prodotto FOREIGN KEY (prodotto_id) REFERENCES prodotti (id) ON DELETE CASCADE
    ) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`;

  it('CREATE TABLE in stile MySQL', () => {
    expect(run(createSql).message).toBe('Tabella creata.');
    expect(run("INSERT INTO recensioni (prodotto_id, voto, titolo) VALUES (1, 5, 'Ottimo')").insertId).toBe(1);
    const cols = rows('SHOW COLUMNS FROM recensioni');
    expect(cols.find((c) => c.Field === 'id')).toMatchObject({ Type: 'int', Key: 'PRI', Extra: 'auto_increment' });
    expect(cols.find((c) => c.Field === 'stato').Type).toBe("enum('bozza','pubblicata')");
    expect(cols.find((c) => c.Field === 'titolo').Key).toBe('UNI');
    expect(cols.find((c) => c.Field === 'prodotto_id').Key).toBe('MUL');
    expect(cols.find((c) => c.Field === 'aggiornata_il').Extra).toContain('on update CURRENT_TIMESTAMP');
    expect(errorOf("INSERT INTO recensioni (prodotto_id, voto, titolo) VALUES (1, 9, 'Troppo')")).toContain('Valore non ammesso');
    expect(rows('SHOW INDEX FROM recensioni').map((r) => r.Key_name)).toEqual(expect.arrayContaining(['PRIMARY', 'uk_titolo', 'idx_prodotto']));
    expect(value('SHOW CREATE TABLE recensioni').length).toBeGreaterThan(0);
  });

  it('ON UPDATE CURRENT_TIMESTAMP aggiorna la colonna', () => {
    run(createSql);
    run("INSERT INTO recensioni (prodotto_id, voto, titolo, aggiornata_il) VALUES (1, 4, 'Buono', '2000-01-01 00:00:00')");
    run("UPDATE recensioni SET voto = 3 WHERE titolo = 'Buono'");
    expect(value("SELECT aggiornata_il FROM recensioni WHERE titolo = 'Buono'")).not.toBe('2000-01-01 00:00:00');
  });

  it('ALTER TABLE: aggiunta, modifica, rinomina ed eliminazione di colonne', () => {
    run('ALTER TABLE clienti ADD COLUMN eta INT NOT NULL AFTER cognome');
    expect(rows('DESCRIBE clienti').map((c) => c.Field)).toEqual(['id', 'nome', 'cognome', 'eta', 'email', 'telefono', 'data_registrazione']);
    expect(value('SELECT eta FROM clienti WHERE id = 1')).toBe(0);
    run('ALTER TABLE clienti MODIFY telefono VARCHAR(30) NOT NULL');
    expect(rows('DESCRIBE clienti').find((c) => c.Field === 'telefono')).toMatchObject({ Type: 'varchar(30)', Null: 'NO' });
    run('ALTER TABLE clienti CHANGE COLUMN eta anni SMALLINT');
    run('ALTER TABLE clienti RENAME COLUMN anni TO eta_anni');
    expect(rows('DESCRIBE clienti').map((c) => c.Field)).toContain('eta_anni');
    run('ALTER TABLE clienti DROP COLUMN eta_anni, ALTER COLUMN telefono SET DEFAULT \'-\'');
    expect(rows('DESCRIBE clienti').find((c) => c.Field === 'telefono').Default).toBe('-');
    expect(value('SELECT COUNT(*) FROM clienti')).toBe(4);
    // le chiavi esterne verso clienti funzionano ancora
    expect(errorOf('INSERT INTO ordini (cliente_id, totale) VALUES (99, 10)')).toContain('chiave esterna');
  });

  it('ALTER TABLE: indici, chiavi esterne e rinomina della tabella', () => {
    run('ALTER TABLE prodotti ADD INDEX idx_nome (nome)');
    expect(rows('SHOW INDEX FROM prodotti').map((r) => r.Key_name)).toContain('idx_nome');
    run('ALTER TABLE prodotti DROP INDEX idx_nome');
    run('CREATE TABLE fornitori (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(50))');
    run('ALTER TABLE prodotti ADD COLUMN fornitore_id INT, ADD CONSTRAINT fk_fornitore FOREIGN KEY (fornitore_id) REFERENCES fornitori(id)');
    expect(errorOf('UPDATE prodotti SET fornitore_id = 7 WHERE id = 1')).toContain('chiave esterna');
    run('ALTER TABLE prodotti DROP FOREIGN KEY fk_fornitore');
    run('UPDATE prodotti SET fornitore_id = 7 WHERE id = 1');
    run('ALTER TABLE fornitori RENAME TO aziende');
    run('RENAME TABLE aziende TO fornitori_vecchi');
    expect(rows('SHOW TABLES').map((r) => r.Tables_in_queryforge)).toContain('fornitori_vecchi');
    run('ALTER TABLE clienti ADD COLUMN creato_il DATETIME DEFAULT CURRENT_TIMESTAMP');
    expect(value('SELECT creato_il FROM clienti WHERE id = 1')).toMatch(/^\d{4}-/);
  });

  it('indici, viste, CREATE TABLE ... LIKE / AS SELECT', () => {
    run('CREATE INDEX idx_cognome ON clienti (cognome(10))');
    run('DROP INDEX idx_cognome ON clienti');
    run('CREATE VIEW vista_ordini AS SELECT o.id, c.nome, o.totale / 2 FROM ordini o JOIN clienti c ON c.id = o.cliente_id');
    expect(run('SELECT * FROM vista_ordini').columns).toEqual(['id', 'nome', 'o.totale / 2']);
    run('CREATE OR REPLACE VIEW vista_ordini AS SELECT id FROM ordini');
    expect(run('SELECT * FROM vista_ordini').columns).toEqual(['id']);
    run('DROP VIEW vista_ordini');
    run('CREATE TABLE clienti_copia LIKE clienti');
    expect(rows('DESCRIBE clienti_copia').length).toBe(6);
    run('CREATE TABLE riepilogo AS SELECT stato, COUNT(*) AS n FROM ordini GROUP BY stato');
    expect(value('SELECT SUM(n) FROM riepilogo')).toBe(4);
  });
});

describe('comandi non disponibili nel browser', () => {
  it('spiegano il motivo', () => {
    expect(errorOf('SET @totale = 5')).toContain('variabili');
    expect(errorOf('SELECT * FROM information_schema.tables')).toContain('information_schema');
    expect(errorOf('CREATE PROCEDURE p() BEGIN SELECT 1; END')).toContain('Procedure');
    expect(errorOf('DELIMITER //')).toContain('DELIMITER');
    expect(errorOf('INSERT INTO clienti (nome, cognome) VALUES (?, ?)')).toContain('punti di domanda');
    expect(errorOf('DROP DATABASE negozio')).toContain('un solo database');
  });

  it('accettano i comandi innocui degli script', () => {
    expect(run('CREATE DATABASE IF NOT EXISTS negozio').message).toContain('un solo database');
    expect(run('USE negozio').message).toContain('queryforge');
    expect(run('SET NAMES utf8mb4').message).toBeTruthy();
    expect(rows('SHOW DATABASES')).toEqual([{ Database: 'queryforge' }]);
    expect(rows('SELECT * FROM negozio.clienti').length).toBe(4);
  });
});

describe('salvataggio', () => {
  it('riapre il database esportato con funzioni e chiavi esterne attive', () => {
    run("INSERT INTO categorie (nome) VALUES ('Salvata')");
    expect(engine.isDirty()).toBe(true);
    const bytes = engine.export();
    expect(engine.isDirty()).toBe(false);
    const reopened = new Engine(SQL, bytes);
    expect(reopened.execute("SELECT YEAR('2024-01-01'), COUNT(*) FROM categorie").rows[0]).toEqual({ "YEAR('2024-01-01')": 2024, 'COUNT(*)': 5 });
    expect(() => reopened.execute('INSERT INTO ordini (cliente_id, totale) VALUES (99, 1)')).toThrow();
    // dopo export le funzioni MySQL restano disponibili anche sul database originale
    expect(engine.execute("SELECT LEFT('abc', 1)").rows[0]).toEqual({ "LEFT('abc', 1)": 'a' });
  });

  it('reset riporta i dati iniziali', () => {
    run('DELETE FROM dettagli_ordine');
    engine.reset(template);
    expect(value('SELECT COUNT(*) FROM dettagli_ordine')).toBe(7);
  });
});

describe('arrotondamento di DECIMAL e INT come in MySQL', () => {
  const raw = (sql) => engine.db.exec(sql)[0].values;

  it('un aumento del 10% salva due decimali', () => {
    expect(run('UPDATE prodotti SET prezzo = prezzo * 1.10 WHERE categoria_id = 1').affectedRows).toBe(2);
    expect(rows('SELECT id, prezzo FROM prodotti WHERE categoria_id = 1 ORDER BY id')).toEqual([{ id: 1, prezzo: 879.99 }, { id: 2, prezzo: 1429.99 }]);
    // è il valore salvato, non solo quello mostrato
    expect(raw('SELECT quote(prezzo) FROM prodotti WHERE id = 1')).toEqual([['879.99']]);
  });

  it('INSERT arrotonda per eccesso dalla metà, anche i negativi e i testi', () => {
    expect(run("INSERT INTO prodotti (nome, prezzo, categoria_id) VALUES ('A', 10.555, 1), ('B', -2.345, 1), ('C', '3.14159', 1)").affectedRows).toBe(3);
    expect(rows("SELECT nome, prezzo FROM prodotti WHERE nome IN ('A', 'B', 'C') ORDER BY nome")).toEqual([
      { nome: 'A', prezzo: 10.56 }, { nome: 'B', prezzo: -2.35 }, { nome: 'C', prezzo: 3.14 }
    ]);
  });

  it('le colonne intere non tengono decimali', () => {
    run('UPDATE prodotti SET disponibilita = disponibilita * 1.5 WHERE id = 1');
    expect(value('SELECT disponibilita FROM prodotti WHERE id = 1')).toBe(38);
    expect(raw('SELECT typeof(disponibilita) FROM prodotti WHERE id = 1')).toEqual([['integer']]);
  });

  it('DECIMAL senza scala, NUMERIC, FLOAT e DOUBLE(m,d)', () => {
    run('CREATE TABLE misure (a DECIMAL, b DECIMAL(5,1), c FLOAT, d DOUBLE(6,2), e NUMERIC(8,3))');
    run('INSERT INTO misure VALUES (1.6, 2.25, 3.14159, 1.234, 0.12345)');
    expect(rows('SELECT * FROM misure')[0]).toEqual({ a: 2, b: 2.3, c: 3.14159, d: 1.23, e: 0.123 });
  });

  it('ALTER TABLE e RENAME TABLE: i dati si adattano e i trigger interni seguono la tabella', () => {
    run('ALTER TABLE prodotti MODIFY prezzo DECIMAL(10,1) NOT NULL');
    expect(value('SELECT prezzo FROM prodotti WHERE id = 3')).toBe(20);
    run('ALTER TABLE prodotti RENAME COLUMN prezzo TO prezzo_eur');
    run('UPDATE prodotti SET prezzo_eur = 1.26 WHERE id = 3');
    expect(value('SELECT prezzo_eur FROM prodotti WHERE id = 3')).toBe(1.3);
    run('ALTER TABLE prodotti RENAME TO articoli');
    run('RENAME TABLE articoli TO merce');
    run('UPDATE merce SET prezzo_eur = 2.04 WHERE id = 3');
    expect(value('SELECT prezzo_eur FROM merce WHERE id = 3')).toBe(2);
    expect(raw("SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'merce' ORDER BY name").map((r) => r[0])).toEqual(['qf_round_ins_merce', 'qf_round_upd_merce']);
    expect(rows('DESCRIBE merce').find((c) => c.Field === 'prezzo_eur').Type).toBe('decimal(10,1)');
    expect(rows('SHOW TRIGGERS')).toEqual([]);
  });

  it('con ON UPDATE CURRENT_TIMESTAMP la data resta quella giusta', () => {
    run('CREATE TABLE listino (id INT PRIMARY KEY, prezzo DECIMAL(10,2), agg TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)');
    run("INSERT INTO listino VALUES (1, 1.239, '2020-01-01 00:00:00')");
    expect(rows('SELECT prezzo, agg FROM listino')[0]).toEqual({ prezzo: 1.24, agg: '2020-01-01 00:00:00' });
    run("UPDATE listino SET prezzo = 2.555, agg = '2021-01-01 00:00:00'");
    expect(rows('SELECT prezzo, agg FROM listino')[0]).toEqual({ prezzo: 2.56, agg: '2021-01-01 00:00:00' });
    run('UPDATE listino SET prezzo = 3.333');
    const after = rows('SELECT prezzo, agg FROM listino')[0];
    expect(after.prezzo).toBe(3.33);
    expect(after.agg).not.toBe('2021-01-01 00:00:00');
  });

  it('tabelle temporanee e CREATE TABLE ... LIKE', () => {
    run('CREATE TEMPORARY TABLE carrello (qta INT, prezzo DECIMAL(6,2))');
    run('INSERT INTO carrello VALUES (2.5, 9.999)');
    expect(rows('SELECT * FROM carrello')[0]).toEqual({ qta: 3, prezzo: 10 });
    run('CREATE TABLE prodotti_copia LIKE prodotti');
    run("INSERT INTO prodotti_copia (nome, prezzo) VALUES ('X', 5.555)");
    expect(value("SELECT prezzo FROM prodotti_copia WHERE nome = 'X'")).toBe(5.56);
  });

  it("i database salvati prima della correzione si aggiornano all'apertura", () => {
    // un database "vecchio": senza trigger e con un prezzo a tre decimali
    for (const [name] of raw("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'qf_round_%'")) engine.db.run(`DROP TRIGGER "${name}"`);
    engine.db.run('UPDATE prodotti SET prezzo = 879.989 WHERE id = 1');
    const reopened = new Engine(SQL, engine.export());
    expect(reopened.execute('SELECT prezzo FROM prodotti WHERE id = 1').rows[0].prezzo).toBe(879.99);
    expect(reopened.isDirty()).toBe(true);
    reopened.execute('UPDATE prodotti SET prezzo = prezzo * 1.10 WHERE id = 3');
    expect(reopened.execute('SELECT prezzo FROM prodotti WHERE id = 3').rows[0].prezzo).toBe(21.99);
  });
});
