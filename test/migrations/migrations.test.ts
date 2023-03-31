import fs from 'fs';
import path from 'path';

// Test whether there's as many test as migrations
describe('Database', () => {
  it('Check number of migrations', () => {
    // count migrations test files
    const files2 = fs.readdirSync(path.join(__dirname, '.'));
    let count = 0;
    for (const directory of files2.filter((n) => !n.endsWith('.ts'))) {
      const subfiles = fs.readdirSync(path.join(__dirname, './' + directory));
      if (subfiles.some((n) => n.endsWith('.test.ts'))) {
        count++;
      }
    }

    const migrations = fs.readdirSync(path.join(__dirname, '../../src/migrations'));
    expect(count).toEqual(migrations.length);
  });
});
