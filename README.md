# SheetSQL

SheetSQL is a lightweight SQL engine for Google Sheets. It lets you run familiar SQL statements directly against sheet-backed tables.

- Demo spreadsheet: <https://docs.google.com/spreadsheet/ccc?key=0AlMMHFOg-bRZdHlJSlV5VXpfbElZSHY2c05iem5mR3c&usp=sharing>

## Features

SheetSQL currently supports:

- `CREATE TABLE`
- `DROP TABLE`
- `ALTER TABLE`
- `INSERT INTO`
- `DELETE FROM`
- `UPDATE`
- `SELECT`

### SELECT capabilities

- Arithmetic expressions (`+`, `-`, `/`)
- Aggregate functions (`MAX`, `MIN`, `COUNT`, `AVG`, `SUM`)
- `DISTINCT` / `DISTINCT *`
- `FROM`
- `JOIN`, `LEFT JOIN`, `RIGHT JOIN`, `ON`
- `UNION`
- `WHERE`, `AND`, `OR`, `IN`, `LIKE`, `IS NULL`, `IS NOT NULL`
- `GROUP BY`
- `HAVING`
- `ORDER BY`
- `LIMIT`

### Fast select (`RANGE`)

You can run a query against the currently selected range:

1. Select a range in a table.
2. Use `RANGE` in `FROM`, for example:
   ```sql
   SELECT * FROM RANGE WHERE score > 90
   ```

## Usage

There are two ways to run statements:

1. Open the custom menu: **SQL → Show prompt**.
2. Use a cell formula: `=SQL(statement)`.

Example:

```sql
SELECT DISTINCT a+1, b, MIN(c)
FROM table1
JOIN table2 ON table1.id = table2.id
WHERE (a = 1 AND b LIKE '%dads')
   OR c IN (SELECT c FROM table4)
GROUP BY a, b
HAVING AVG(c) > 5 AND MAX(c) < 10
ORDER BY a DESC
LIMIT 20
UNION
SELECT a+1, b, MIN(c)
FROM table3
GROUP BY a, b;
```

## Project setup (recommended modern workflow)

This project is written for Google Apps Script. A modern setup uses `clasp`:

1. Install Node.js (LTS).
2. Install clasp:
   ```bash
   npm install -g @google/clasp
   ```
3. Authenticate:
   ```bash
   clasp login
   ```
4. Create or clone a script project and push sources:
   ```bash
   clasp create --type sheets --title "SheetSQL"
   clasp push
   ```

> Note: this repository currently stores source in `src/*.gs`. If you use clasp locally,
> keep `.clasp.json` out of version control unless you intentionally want to share script IDs.

## Code quality notes

- Most query execution is implemented in `src/Select.gs`, `src/Insert.gs`, `src/Update.gs`, `src/Delete.gs`, and `src/Table.gs`.
- Parser sources in `src/SQLParser.gs` and `src/SimpleSQL.gs` are vendored/generated; avoid large manual edits there unless necessary.

## Credits

- [simpleSqlParser](https://github.com/dsferruzza/simpleSqlParser) for parsing `INSERT`, `UPDATE`, `DELETE`
- [sql-parser](https://github.com/forward/sql-parser) for parsing `SELECT`

## License

MIT
