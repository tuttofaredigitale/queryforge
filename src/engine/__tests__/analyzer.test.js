import { describe, it, expect } from 'vitest';
import { analyzeSQLQuery } from '../../utils/queryAnalyzer.js';

const needsConfirmation = (sql) => analyzeSQLQuery(sql).requiresConfirmation;

describe('conferma delle operazioni distruttive', () => {
  it('chiede conferma per DELETE e UPDATE senza WHERE', () => {
    expect(needsConfirmation('DELETE FROM clienti')).toBe(true);
    expect(needsConfirmation('UPDATE prodotti SET prezzo = 0')).toBe(true);
    expect(needsConfirmation('DROP TABLE clienti')).toBe(true);
    expect(needsConfirmation('TRUNCATE TABLE ordini')).toBe(true);
    expect(needsConfirmation('SELECT 1; DELETE FROM ordini')).toBe(true);
  });

  it('non chiede conferma quando non serve', () => {
    expect(needsConfirmation('UPDATE prodotti\nSET prezzo = 0\nWHERE id = 1')).toBe(false);
    expect(needsConfirmation('DELETE FROM clienti WHERE id = 3')).toBe(false);
    expect(needsConfirmation('INSERT INTO t (id, n) VALUES (1, 2) ON DUPLICATE KEY UPDATE n = 3')).toBe(false);
    expect(needsConfirmation('CREATE TABLE t (d TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)')).toBe(false);
    expect(needsConfirmation("SELECT 'DELETE FROM clienti'")).toBe(false);
  });

  it('mostra il testo dell\'avviso', () => {
    const { issues } = analyzeSQLQuery('DELETE FROM clienti');
    expect(issues[0].message.text).toContain('DELETE senza clausola WHERE');
  });
});
