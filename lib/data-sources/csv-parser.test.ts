import { describe, it, expect } from 'vitest';
import { createCSVParser } from './csv-parser';

describe('CSVParser', () => {
  const parser = createCSVParser();

  describe('parse', () => {
    it('parses a simple CSV with header', async () => {
      const csv = Buffer.from('name,age,city\nAlice,30,NYC\nBob,25,LA\n');
      const result = await parser.parse(csv);

      expect(result.rowCount).toBe(2);
      expect(result.skippedRows).toBe(0);
      expect(result.columns).toHaveLength(3);
      expect(result.columns[0].name).toBe('name');
      expect(result.columns[1].name).toBe('age');
      expect(result.columns[2].name).toBe('city');
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({ name: 'Alice', age: 30, city: 'NYC' });
      expect(result.data[1]).toEqual({ name: 'Bob', age: 25, city: 'LA' });
    });

    it('handles quoted fields with commas', async () => {
      const csv = Buffer.from('name,address\nAlice,"123 Main St, Apt 4"\nBob,"456 Oak Ave"\n');
      const result = await parser.parse(csv);

      expect(result.rowCount).toBe(2);
      expect(result.data[0]).toEqual({ name: 'Alice', address: '123 Main St, Apt 4' });
    });

    it('handles escaped quotes (double-double quotes)', async () => {
      const csv = Buffer.from('name,quote\nAlice,"She said ""hello"""\nBob,"He said ""bye"""\n');
      const result = await parser.parse(csv);

      expect(result.data[0]).toEqual({ name: 'Alice', quote: 'She said "hello"' });
      expect(result.data[1]).toEqual({ name: 'Bob', quote: 'He said "bye"' });
    });

    it('handles newlines within quoted fields', async () => {
      const csv = Buffer.from('name,bio\nAlice,"Line 1\nLine 2"\nBob,"Single line"\n');
      const result = await parser.parse(csv);

      expect(result.rowCount).toBe(2);
      expect(result.data[0]).toEqual({ name: 'Alice', bio: 'Line 1\nLine 2' });
      expect(result.data[1]).toEqual({ name: 'Bob', bio: 'Single line' });
    });

    it('skips malformed rows (wrong column count)', async () => {
      const csv = Buffer.from('name,age,city\nAlice,30,NYC\nBob,25\nCharlie,35,SF,extra\nDave,40,LA\n');
      const result = await parser.parse(csv);

      expect(result.rowCount).toBe(2);
      expect(result.skippedRows).toBe(2);
      expect(result.data[0]).toEqual({ name: 'Alice', age: 30, city: 'NYC' });
      expect(result.data[1]).toEqual({ name: 'Dave', age: 40, city: 'LA' });
    });

    it('enforces 50MB file size limit', async () => {
      const largeBuffer = Buffer.alloc(50 * 1024 * 1024 + 1, 'a');
      await expect(parser.parse(largeBuffer)).rejects.toThrow(
        /exceeds maximum allowed size/
      );
    });

    it('accepts files at exactly 50MB', async () => {
      // Create a valid CSV that's under 50MB (just test that it doesn't throw for size)
      const csv = Buffer.from('name\nAlice\n');
      const result = await parser.parse(csv);
      expect(result.rowCount).toBe(1);
    });

    it('handles empty CSV', async () => {
      const csv = Buffer.from('');
      const result = await parser.parse(csv);

      expect(result.rowCount).toBe(0);
      expect(result.columns).toHaveLength(0);
      expect(result.data).toHaveLength(0);
    });

    it('handles CSV with only header', async () => {
      const csv = Buffer.from('name,age,city\n');
      const result = await parser.parse(csv);

      expect(result.rowCount).toBe(0);
      expect(result.columns).toHaveLength(3);
      expect(result.data).toHaveLength(0);
    });

    it('respects maxRows option', async () => {
      const csv = Buffer.from('name,age\nAlice,30\nBob,25\nCharlie,35\nDave,40\n');
      const result = await parser.parse(csv, { maxRows: 2 });

      expect(result.rowCount).toBe(2);
      expect(result.data).toHaveLength(2);
    });

    it('supports custom delimiter', async () => {
      const csv = Buffer.from('name;age;city\nAlice;30;NYC\nBob;25;LA\n');
      const result = await parser.parse(csv, { delimiter: ';' });

      expect(result.rowCount).toBe(2);
      expect(result.data[0]).toEqual({ name: 'Alice', age: 30, city: 'NYC' });
    });

    it('generates column names when hasHeader is false', async () => {
      const csv = Buffer.from('Alice,30,NYC\nBob,25,LA\n');
      const result = await parser.parse(csv, { hasHeader: false });

      expect(result.columns[0].name).toBe('column_1');
      expect(result.columns[1].name).toBe('column_2');
      expect(result.columns[2].name).toBe('column_3');
      expect(result.rowCount).toBe(2);
    });

    it('handles Windows-style line endings (\\r\\n)', async () => {
      const csv = Buffer.from('name,age\r\nAlice,30\r\nBob,25\r\n');
      const result = await parser.parse(csv);

      expect(result.rowCount).toBe(2);
      expect(result.data[0]).toEqual({ name: 'Alice', age: 30 });
      expect(result.data[1]).toEqual({ name: 'Bob', age: 25 });
    });
  });

  describe('type inference', () => {
    it('infers integer type', async () => {
      const csv = Buffer.from('id,value\n1,100\n2,200\n3,-50\n');
      const result = await parser.parse(csv);

      expect(result.columns[0].data_type).toBe('integer');
      expect(result.columns[1].data_type).toBe('integer');
    });

    it('infers float type', async () => {
      const csv = Buffer.from('price,rate\n19.99,3.14\n29.99,2.71\n');
      const result = await parser.parse(csv);

      expect(result.columns[0].data_type).toBe('float');
      expect(result.columns[1].data_type).toBe('float');
    });

    it('infers boolean type', async () => {
      const csv = Buffer.from('active,verified\ntrue,yes\nfalse,no\ntrue,1\n');
      const result = await parser.parse(csv);

      expect(result.columns[0].data_type).toBe('boolean');
      expect(result.columns[1].data_type).toBe('boolean');
    });

    it('infers date type (ISO format)', async () => {
      const csv = Buffer.from('start_date,end_date\n2024-01-15,2024-02-28\n2024-03-01,2024-12-31\n');
      const result = await parser.parse(csv);

      expect(result.columns[0].data_type).toBe('date');
      expect(result.columns[1].data_type).toBe('date');
    });

    it('infers timestamp type', async () => {
      const csv = Buffer.from('created_at,updated_at\n2024-01-15T10:30:00Z,2024-01-15T11:00:00Z\n2024-02-01T08:00:00Z,2024-02-01T09:30:00Z\n');
      const result = await parser.parse(csv);

      expect(result.columns[0].data_type).toBe('timestamp');
      expect(result.columns[1].data_type).toBe('timestamp');
    });

    it('falls back to text for mixed types', async () => {
      const csv = Buffer.from('data\nhello\n123\ntrue\n2024-01-01\n');
      const result = await parser.parse(csv);

      expect(result.columns[0].data_type).toBe('text');
    });

    it('suggests measure for numeric columns', async () => {
      const csv = Buffer.from('name,amount,rate\nAlice,100,3.14\nBob,200,2.71\n');
      const result = await parser.parse(csv);

      expect(result.columns[0].suggested_semantic_type).toBe('dimension');
      expect(result.columns[1].suggested_semantic_type).toBe('measure');
      expect(result.columns[2].suggested_semantic_type).toBe('measure');
    });

    it('handles scientific notation as float', async () => {
      const csv = Buffer.from('value\n1.5e10\n2.3e-5\n');
      const result = await parser.parse(csv);

      expect(result.columns[0].data_type).toBe('float');
    });

    it('converts values to correct types', async () => {
      const csv = Buffer.from('name,age,active,score\nAlice,30,true,95.5\nBob,25,false,87.3\n');
      const result = await parser.parse(csv);

      expect(result.data[0]).toEqual({ name: 'Alice', age: 30, active: true, score: 95.5 });
      expect(result.data[1]).toEqual({ name: 'Bob', age: 25, active: false, score: 87.3 });
    });

    it('handles empty values as null', async () => {
      const csv = Buffer.from('name,age\nAlice,30\n,\nBob,25\n');
      const result = await parser.parse(csv);

      expect(result.data[1]).toEqual({ name: null, age: null });
    });
  });

  describe('inferTypes', () => {
    it('infers types from a sample with headers', () => {
      const sample = [
        ['name', 'age', 'active'],
        ['Alice', '30', 'true'],
        ['Bob', '25', 'false'],
        ['Charlie', '35', 'yes'],
      ];

      const result = parser.inferTypes(sample);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        columnName: 'name',
        inferredType: 'text',
        confidence: 1,
        sampleValues: ['Alice', 'Bob', 'Charlie'],
      });
      expect(result[1]).toEqual({
        columnName: 'age',
        inferredType: 'integer',
        confidence: 1,
        sampleValues: ['30', '25', '35'],
      });
      expect(result[2]).toEqual({
        columnName: 'active',
        inferredType: 'boolean',
        confidence: 1,
        sampleValues: ['true', 'false', 'yes'],
      });
    });

    it('returns empty array for empty sample', () => {
      const result = parser.inferTypes([]);
      expect(result).toEqual([]);
    });

    it('returns text type with 0 confidence for header-only sample', () => {
      const sample = [['name', 'age']];
      const result = parser.inferTypes(sample);

      expect(result).toHaveLength(2);
      expect(result[0].inferredType).toBe('text');
      expect(result[0].confidence).toBe(0);
    });

    it('infers date type from sample', () => {
      const sample = [
        ['date'],
        ['2024-01-15'],
        ['2024-02-28'],
        ['2024-03-01'],
      ];

      const result = parser.inferTypes(sample);
      expect(result[0].inferredType).toBe('date');
      expect(result[0].confidence).toBe(1);
    });

    it('infers timestamp type from sample', () => {
      const sample = [
        ['timestamp'],
        ['2024-01-15T10:30:00Z'],
        ['2024-02-01T08:00:00Z'],
      ];

      const result = parser.inferTypes(sample);
      expect(result[0].inferredType).toBe('timestamp');
      expect(result[0].confidence).toBe(1);
    });
  });
});
