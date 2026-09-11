// ===== CSV Parser Utility =====
const CSVParser = {
  MAX_FILE_SIZE: 2 * 1024 * 1024,
  MAX_ROWS: 5000,

  schemas: {
    team: {
      required: ['Team Name', 'Kill', 'Total Score', 'Survival Score', 'Damage', 'BOOYAH!', 'Match Rank'],
      names: ['Team Name'],
      numbers: ['Kill', 'Total Score', 'Survival Score', 'Damage', 'BOOYAH!', 'Match Rank']
    },
    player: {
      required: ['Player Name', 'Team Name', 'Kill', 'Damage', 'Assist', 'Knock Down', 'Headshots'],
      names: ['Player Name', 'Team Name'],
      numbers: ['Kill', 'Damage', 'Assist', 'Knock Down', 'Headshots']
    }
  },

  parse(csvText, type) {
    const schema = this.schemas[type];
    if (!schema) throw new Error('Unknown CSV type');

    const result = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: header => header.replace(/^\uFEFF/, '').trim()
    });

    if (result.errors.length) {
      const error = result.errors[0];
      const row = Number.isInteger(error.row) ? ` on row ${error.row + 2}` : '';
      throw new Error(`CSV parse error${row}: ${error.message}`);
    }

    const headers = result.meta.fields || [];
    const missing = schema.required.filter(header => !headers.includes(header));
    if (missing.length) throw new Error(`Missing columns: ${missing.join(', ')}`);
    if (!result.data.length) throw new Error('CSV contains no data rows');
    if (result.data.length > this.MAX_ROWS) throw new Error(`CSV cannot exceed ${this.MAX_ROWS} rows`);

    const seen = new Set();
    return result.data.map((row, index) => {
      const output = {};
      for (const field of schema.names) {
        const value = String(row[field] ?? '').trim();
        if (!value) throw new Error(`${field} is required on row ${index + 2}`);
        if (value.length > 100) throw new Error(`${field} is too long on row ${index + 2}`);
        output[field] = value;
      }
      for (const field of schema.numbers) {
        const raw = String(row[field] ?? '').trim();
        const value = Number(raw);
        if (!raw || !Number.isInteger(value) || value < 0) {
          throw new Error(`${field} must be a non-negative whole number on row ${index + 2}`);
        }
        if (field === 'Match Rank' && value < 1) {
          throw new Error(`Match Rank must be at least 1 on row ${index + 2}`);
        }
        output[field] = value;
      }

      const uniqueName = schema.names.map(field => output[field]).join('\u0000');
      if (seen.has(uniqueName)) throw new Error(`Duplicate ${schema.names.join(' / ')} on row ${index + 2}`);
      seen.add(uniqueName);
      return output;
    });
  }
};
