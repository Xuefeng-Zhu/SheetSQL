'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createMockSpreadsheetApp } = require('./helpers');

// ---------------------------------------------------------------------------
// Load all source files into a single VM context
// ---------------------------------------------------------------------------

function loadExecutorContext(mockApp) {
  const srcDir = path.join(__dirname, '..', 'src');

  // Order matters: dependencies must be loaded before dependents
  const files = [
    'SimpleSQL.gs',
    'SQLParser.gs',
    'RA.gs',
    'Where.gs',
    'SheetIO.gs',
    'QueryPlanner.gs',
    'Select.gs',
    'Insert.gs',
    'Update.gs',
    'Delete.gs',
    'Table.gs',
    'SQL.gs',
  ];

  const sandbox = {
    console,
    SpreadsheetApp: mockApp,
  };

  vm.createContext(sandbox);

  for (let i = 0; i < files.length; i++) {
    const source = fs.readFileSync(path.join(srcDir, files[i]), 'utf8');
    vm.runInContext(source, sandbox, { filename: files[i] });
  }

  return sandbox;
}

/**
 * Assert that a function throws an error with the expected message.
 */
function assertThrowsMessage(fn, expectedMessage) {
  let threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
    const msg = err.message || String(err);
    assert.strictEqual(msg, expectedMessage,
      'Expected error "' + expectedMessage + '" but got "' + msg + '"');
  }
  assert.ok(threw, 'Expected function to throw with message: ' + expectedMessage);
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (err) {
    failed++;
    console.log('  ✗ ' + name);
    console.log('    ' + (err.message || err));
  }
}

// ===========================================================================
// selectQuery tests
// ===========================================================================

console.log('\nselectQuery');

test('simple SELECT * FROM table', function () {
  const mockApp = createMockSpreadsheetApp({
    employees: [
      ['id', 'name', 'dept'],
      [1, 'Alice', 'Eng'],
      [2, 'Bob', 'Sales'],
    ],
  });
  const ctx = loadExecutorContext(mockApp);

  const result = ctx.selectQuery('SELECT * FROM employees');

  // Should return [headers, ...dataRows] without table name row
  assert.strictEqual(result.length, 3);
  assert.deepStrictEqual(result[0], ['id', 'name', 'dept']);
  assert.deepStrictEqual(result[1], [1, 'Alice', 'Eng']);
  assert.deepStrictEqual(result[2], [2, 'Bob', 'Sales']);
});

test('SELECT with WHERE clause', function () {
  const mockApp = createMockSpreadsheetApp({
    employees: [
      ['id', 'name', 'salary'],
      [1, 'Alice', 80000],
      [2, 'Bob', 60000],
      [3, 'Carol', 90000],
    ],
  });
  const ctx = loadExecutorContext(mockApp);

  const result = ctx.selectQuery('SELECT * FROM employees WHERE salary > 70000');

  assert.strictEqual(result.length, 3); // headers + 2 data rows
  assert.deepStrictEqual(result[0], ['id', 'name', 'salary']);
  assert.deepStrictEqual(result[1], [1, 'Alice', 80000]);
  assert.deepStrictEqual(result[2], [3, 'Carol', 90000]);
});

test('SELECT with JOIN', function () {
  const mockApp = createMockSpreadsheetApp({
    employees: [
      ['id', 'name', 'dept'],
      [1, 'Alice', 'Eng'],
      [2, 'Bob', 'Sales'],
    ],
    departments: [
      ['dept_name', 'location'],
      ['Eng', 'Building A'],
      ['Sales', 'Building B'],
    ],
  });
  const ctx = loadExecutorContext(mockApp);

  const result = ctx.selectQuery(
    'SELECT * FROM employees JOIN departments ON dept = dept_name'
  );

  // Should have headers from both tables
  assert.strictEqual(result.length, 3); // headers + 2 joined rows
  assert.deepStrictEqual(result[0], ['id', 'name', 'dept', 'dept_name', 'location']);
  assert.deepStrictEqual(result[1], [1, 'Alice', 'Eng', 'Eng', 'Building A']);
  assert.deepStrictEqual(result[2], [2, 'Bob', 'Sales', 'Sales', 'Building B']);
});

test('SELECT with ORDER BY', function () {
  const mockApp = createMockSpreadsheetApp({
    employees: [
      ['id', 'name', 'salary'],
      [1, 'Carol', 90000],
      [2, 'Alice', 80000],
      [3, 'Bob', 60000],
    ],
  });
  const ctx = loadExecutorContext(mockApp);

  const result = ctx.selectQuery('SELECT * FROM employees ORDER BY name ASC');

  assert.strictEqual(result.length, 4);
  assert.strictEqual(result[1][1], 'Alice');
  assert.strictEqual(result[2][1], 'Bob');
  assert.strictEqual(result[3][1], 'Carol');
});

test('SELECT with LIMIT', function () {
  const mockApp = createMockSpreadsheetApp({
    employees: [
      ['id', 'name'],
      [1, 'Alice'],
      [2, 'Bob'],
      [3, 'Carol'],
    ],
  });
  const ctx = loadExecutorContext(mockApp);

  const result = ctx.selectQuery('SELECT * FROM employees LIMIT 2');

  // Should return headers + 2 data rows
  assert.strictEqual(result.length, 3);
  assert.deepStrictEqual(result[0], ['id', 'name']);
  assert.deepStrictEqual(result[1], [1, 'Alice']);
  assert.deepStrictEqual(result[2], [2, 'Bob']);
});

test('SELECT specific columns', function () {
  const mockApp = createMockSpreadsheetApp({
    employees: [
      ['id', 'name', 'salary'],
      [1, 'Alice', 80000],
      [2, 'Bob', 60000],
    ],
  });
  const ctx = loadExecutorContext(mockApp);

  const result = ctx.selectQuery('SELECT name, salary FROM employees');

  assert.strictEqual(result.length, 3);
  assert.strictEqual(JSON.stringify(result[0]), JSON.stringify(['name', 'salary']));
  assert.strictEqual(JSON.stringify(result[1]), JSON.stringify(['Alice', 80000]));
  assert.strictEqual(JSON.stringify(result[2]), JSON.stringify(['Bob', 60000]));
});

test('SELECT with column alias', function () {
  const mockApp = createMockSpreadsheetApp({
    employees: [
      ['id', 'name'],
      [1, 'Alice'],
    ],
  });
  const ctx = loadExecutorContext(mockApp);

  const result = ctx.selectQuery('SELECT name AS employee_name FROM employees');

  assert.strictEqual(result[0][0], 'employee_name');
});

test('SELECT DISTINCT', function () {
  const mockApp = createMockSpreadsheetApp({
    employees: [
      ['id', 'dept'],
      [1, 'Eng'],
      [2, 'Sales'],
      [3, 'Eng'],
    ],
  });
  const ctx = loadExecutorContext(mockApp);

  const result = ctx.selectQuery('SELECT DISTINCT dept FROM employees');

  assert.strictEqual(result.length, 3); // headers + 2 unique depts
  assert.strictEqual(result[0][0], 'dept');
});

// ===========================================================================
// insert tests
// ===========================================================================

console.log('\ninsert');

test('positional insert', function () {
  const mockApp = createMockSpreadsheetApp({
    employees: [
      ['id', 'name', 'salary'],
    ],
  });
  const ctx = loadExecutorContext(mockApp);

  ctx.insert("INSERT INTO employees VALUES (1, 'Alice', 80000)");

  const sheet = mockApp._spreadsheet._sheets['employees'];
  const values = sheet._getValues();
  assert.strictEqual(values.length, 2); // header + 1 data row
  assert.deepStrictEqual(values[1], [1, 'Alice', 80000]);
});

test('column-mapped insert', function () {
  const mockApp = createMockSpreadsheetApp({
    employees: [
      ['id', 'name', 'salary'],
    ],
  });
  const ctx = loadExecutorContext(mockApp);

  ctx.insert("INSERT INTO employees (name, salary) VALUES ('Bob', 60000)");

  const sheet = mockApp._spreadsheet._sheets['employees'];
  const values = sheet._getValues();
  assert.strictEqual(values.length, 2);
  // id should be empty, name and salary should be filled
  assert.strictEqual(values[1][0], '');
  assert.strictEqual(values[1][1], 'Bob');
  assert.strictEqual(values[1][2], 60000);
});

test('insert throws on column count mismatch', function () {
  const mockApp = createMockSpreadsheetApp({
    employees: [
      ['id', 'name', 'salary'],
    ],
  });
  const ctx = loadExecutorContext(mockApp);

  assertThrowsMessage(
    function () { ctx.insert("INSERT INTO employees VALUES (1, 'Alice')"); },
    'The number of columns does not match'
  );
});

// ===========================================================================
// update tests
// ===========================================================================

console.log('\nupdate');

test('UPDATE with WHERE', function () {
  const mockApp = createMockSpreadsheetApp({
    employees: [
      ['id', 'name', 'salary'],
      [1, 'Alice', 80000],
      [2, 'Bob', 60000],
      [3, 'Carol', 90000],
    ],
  });
  const ctx = loadExecutorContext(mockApp);

  ctx.update("UPDATE employees SET salary=50000 WHERE name='Bob'");

  const sheet = mockApp._spreadsheet._sheets['employees'];
  const values = sheet._getValues();
  // Bob's salary should be updated
  assert.strictEqual(values[2][2], 50000);
  // Others should be unchanged
  assert.strictEqual(values[1][2], 80000);
  assert.strictEqual(values[3][2], 90000);
});

test('UPDATE without WHERE updates all rows', function () {
  const mockApp = createMockSpreadsheetApp({
    employees: [
      ['id', 'name', 'salary'],
      [1, 'Alice', 80000],
      [2, 'Bob', 60000],
    ],
  });
  const ctx = loadExecutorContext(mockApp);

  ctx.update("UPDATE employees SET salary=0");

  const sheet = mockApp._spreadsheet._sheets['employees'];
  const values = sheet._getValues();
  assert.strictEqual(values[1][2], 0);
  assert.strictEqual(values[2][2], 0);
});

// ===========================================================================
// deleteFrom tests
// ===========================================================================

console.log('\ndeleteFrom');

test('DELETE with WHERE', function () {
  const mockApp = createMockSpreadsheetApp({
    employees: [
      ['id', 'name', 'salary'],
      [1, 'Alice', 80000],
      [2, 'Bob', 60000],
      [3, 'Carol', 90000],
    ],
  });
  const ctx = loadExecutorContext(mockApp);

  ctx.deleteFrom("DELETE FROM employees WHERE name='Bob'");

  const sheet = mockApp._spreadsheet._sheets['employees'];
  const values = sheet._getValues();
  assert.strictEqual(values.length, 3); // header + 2 remaining rows
  assert.deepStrictEqual(values[0], ['id', 'name', 'salary']);
  assert.deepStrictEqual(values[1], [1, 'Alice', 80000]);
  assert.deepStrictEqual(values[2], [3, 'Carol', 90000]);
});

test('DELETE without WHERE deletes all data rows', function () {
  const mockApp = createMockSpreadsheetApp({
    employees: [
      ['id', 'name'],
      [1, 'Alice'],
      [2, 'Bob'],
    ],
  });
  const ctx = loadExecutorContext(mockApp);

  ctx.deleteFrom("DELETE FROM employees");

  const sheet = mockApp._spreadsheet._sheets['employees'];
  const values = sheet._getValues();
  assert.strictEqual(values.length, 1); // only header remains
  assert.deepStrictEqual(values[0], ['id', 'name']);
});

// ===========================================================================
// DDL tests (createTable, dropTable, alterTable)
// ===========================================================================

console.log('\ncreateTable');

test('CREATE TABLE with columns', function () {
  const mockApp = createMockSpreadsheetApp({});
  const ctx = loadExecutorContext(mockApp);

  ctx.createTable('CREATE TABLE products (id, name, price)');

  const sheet = mockApp._spreadsheet._sheets['products'];
  assert.ok(sheet, 'Sheet should be created');
  const values = sheet._getValues();
  assert.deepStrictEqual(values[0], ['id', 'name', 'price']);
});

test('CREATE TABLE without columns', function () {
  const mockApp = createMockSpreadsheetApp({});
  const ctx = loadExecutorContext(mockApp);

  ctx.createTable('CREATE TABLE empty_table');

  const sheet = mockApp._spreadsheet._sheets['empty_table'];
  assert.ok(sheet, 'Sheet should be created');
});

test('CREATE TABLE throws if table exists', function () {
  const mockApp = createMockSpreadsheetApp({ existing: [['id']] });
  const ctx = loadExecutorContext(mockApp);

  assertThrowsMessage(
    function () { ctx.createTable('CREATE TABLE existing (id)'); },
    'Table already exists: existing'
  );
});

console.log('\ndropTable');

test('DROP TABLE removes sheet', function () {
  const mockApp = createMockSpreadsheetApp({ products: [['id']] });
  const ctx = loadExecutorContext(mockApp);

  ctx.dropTable('DROP TABLE products');

  assert.strictEqual(mockApp._spreadsheet._sheets['products'], undefined);
});

test('DROP TABLE throws if table does not exist', function () {
  const mockApp = createMockSpreadsheetApp({});
  const ctx = loadExecutorContext(mockApp);

  assertThrowsMessage(
    function () { ctx.dropTable('DROP TABLE ghost'); },
    'Invalid sheet : ghost'
  );
});

console.log('\nalterTable');

test('ALTER TABLE ADD column', function () {
  const mockApp = createMockSpreadsheetApp({
    products: [['id', 'name']],
  });
  const ctx = loadExecutorContext(mockApp);

  ctx.alterTable('ALTER TABLE products ADD price');

  const sheet = mockApp._spreadsheet._sheets['products'];
  const values = sheet._getValues();
  assert.strictEqual(values[0][2], 'price');
});

test('ALTER TABLE DROP column', function () {
  const mockApp = createMockSpreadsheetApp({
    products: [
      ['id', 'name', 'price'],
      [1, 'Widget', 9.99],
    ],
  });
  const ctx = loadExecutorContext(mockApp);

  // Need to add deleteColumn to mock
  const sheet = mockApp._spreadsheet._sheets['products'];
  sheet.deleteColumn = function (colIndex) {
    const vals = sheet._getValues();
    for (let r = 0; r < vals.length; r++) {
      vals[r].splice(colIndex - 1, 1);
    }
  };

  ctx.alterTable('ALTER TABLE products DROP name');

  const values = sheet._getValues();
  assert.strictEqual(values[0].length, 2);
  assert.deepStrictEqual(values[0], ['id', 'price']);
});

// ===========================================================================
// Sheet_IO delegation verification
// ===========================================================================

console.log('\nSheet_IO delegation');

test('selectQuery uses sheetIO_readTable (not direct SpreadsheetApp)', function () {
  let readTableCalled = false;
  const mockApp = createMockSpreadsheetApp({
    employees: [
      ['id', 'name'],
      [1, 'Alice'],
    ],
  });
  const ctx = loadExecutorContext(mockApp);

  // Wrap sheetIO_readTable to track calls
  const origReadTable = ctx.sheetIO_readTable;
  ctx.sheetIO_readTable = function (name) {
    readTableCalled = true;
    return origReadTable(name);
  };

  ctx.selectQuery('SELECT * FROM employees');
  assert.ok(readTableCalled, 'sheetIO_readTable should be called');
});

test('insert uses sheetIO_writeRows (not direct appendRow)', function () {
  let writeRowsCalled = false;
  const mockApp = createMockSpreadsheetApp({
    employees: [['id', 'name']],
  });
  const ctx = loadExecutorContext(mockApp);

  const origWriteRows = ctx.sheetIO_writeRows;
  ctx.sheetIO_writeRows = function (name, rows) {
    writeRowsCalled = true;
    return origWriteRows(name, rows);
  };

  ctx.insert("INSERT INTO employees VALUES (1, 'Alice')");
  assert.ok(writeRowsCalled, 'sheetIO_writeRows should be called');
});

test('update uses sheetIO_updateCells (not direct setValue)', function () {
  let updateCellsCalled = false;
  const mockApp = createMockSpreadsheetApp({
    employees: [
      ['id', 'name', 'salary'],
      [1, 'Alice', 80000],
    ],
  });
  const ctx = loadExecutorContext(mockApp);

  const origUpdateCells = ctx.sheetIO_updateCells;
  ctx.sheetIO_updateCells = function (name, updates) {
    updateCellsCalled = true;
    return origUpdateCells(name, updates);
  };

  ctx.update("UPDATE employees SET salary=90000 WHERE name='Alice'");
  assert.ok(updateCellsCalled, 'sheetIO_updateCells should be called');
});

test('deleteFrom uses sheetIO_deleteRows (not direct deleteRow)', function () {
  let deleteRowsCalled = false;
  const mockApp = createMockSpreadsheetApp({
    employees: [
      ['id', 'name'],
      [1, 'Alice'],
    ],
  });
  const ctx = loadExecutorContext(mockApp);

  const origDeleteRows = ctx.sheetIO_deleteRows;
  ctx.sheetIO_deleteRows = function (name, indices) {
    deleteRowsCalled = true;
    return origDeleteRows(name, indices);
  };

  ctx.deleteFrom("DELETE FROM employees WHERE name='Alice'");
  assert.ok(deleteRowsCalled, 'sheetIO_deleteRows should be called');
});

// ===========================================================================
// End-to-end via SQL() function
// ===========================================================================

console.log('\nSQL() end-to-end');

test('SQL() SELECT returns success row + data', function () {
  const mockApp = createMockSpreadsheetApp({
    employees: [
      ['id', 'name'],
      [1, 'Alice'],
    ],
  });
  const ctx = loadExecutorContext(mockApp);

  const result = ctx.SQL('SELECT * FROM employees');

  assert.ok(result.length >= 2);
  assert.ok(result[0][0].indexOf('success') !== -1);
  assert.deepStrictEqual(result[1], ['id', 'name']);
  assert.deepStrictEqual(result[2], [1, 'Alice']);
});

test('SQL() INSERT returns success row', function () {
  const mockApp = createMockSpreadsheetApp({
    employees: [['id', 'name']],
  });
  const ctx = loadExecutorContext(mockApp);

  const result = ctx.SQL("INSERT INTO employees VALUES (1, 'Alice')");

  assert.strictEqual(result.length, 1);
  assert.ok(result[0][0].indexOf('success') !== -1);
});

test('SQL() error returns Query failed message', function () {
  const mockApp = createMockSpreadsheetApp({});
  const ctx = loadExecutorContext(mockApp);

  const result = ctx.SQL('SELECT * FROM nonexistent');

  assert.strictEqual(result.length, 1);
  assert.ok(result[0][0].indexOf('Query failed:') !== -1);
});

// ===========================================================================
// Summary
// ===========================================================================

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All executor tests passed');
}
