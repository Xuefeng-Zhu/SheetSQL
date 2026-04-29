'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createMockSpreadsheetApp } = require('./helpers');

/**
 * Load SheetIO.gs into a sandboxed context with a mock SpreadsheetApp.
 *
 * @param {object} mockApp - mock SpreadsheetApp instance
 * @returns {object} sandbox with all SheetIO functions
 */
function loadSheetIO(mockApp) {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'SheetIO.gs'),
    'utf8'
  );

  const sandbox = {
    console,
    SpreadsheetApp: mockApp,
    // SQL_SHEET_NAME is defined in SQL.gs; provide it for sheetIO_getOrCreateSqlSheet
    SQL_SHEET_NAME: 'SQL',
  };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox;
}

/**
 * Assert that a function throws an error with the expected message.
 * Works across VM sandbox boundaries where instanceof Error fails.
 */
function assertThrowsMessage(fn, expectedMessage) {
  let threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
    const msg = err.message || String(err);
    assert.strictEqual(msg, expectedMessage,
      'Expected error message "' + expectedMessage + '" but got "' + msg + '"');
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
    console.log('    ' + err.message);
  }
}

// ===========================================================================
// sheetIO_readTable
// ===========================================================================

console.log('\nsheetIO_readTable');

test('returns Table_Array with name header, column headers, and data rows', function () {
  const mockApp = createMockSpreadsheetApp({
    employees: [
      ['id', 'name', 'dept'],
      [1, 'Alice', 'Eng'],
      [2, 'Bob', 'Sales'],
    ],
  });
  const io = loadSheetIO(mockApp);

  const result = io.sheetIO_readTable('employees');
  assert.strictEqual(result.length, 4);
  assert.strictEqual(result[0][0], 'employees');
  assert.strictEqual(result[0].length, 1);
  assert.deepStrictEqual(result[1], ['id', 'name', 'dept']);
  assert.deepStrictEqual(result[2], [1, 'Alice', 'Eng']);
  assert.deepStrictEqual(result[3], [2, 'Bob', 'Sales']);
});

test('throws "Invalid sheet : X" when sheet does not exist', function () {
  const mockApp = createMockSpreadsheetApp({});
  const io = loadSheetIO(mockApp);

  assertThrowsMessage(
    function () { io.sheetIO_readTable('missing'); },
    'Invalid sheet : missing'
  );
});

test('throws "Sheet should atleast have a header" when sheet is empty', function () {
  const mockApp = createMockSpreadsheetApp({ empty: [] });
  const io = loadSheetIO(mockApp);

  assertThrowsMessage(
    function () { io.sheetIO_readTable('empty'); },
    'Sheet should atleast have a header'
  );
});

// ===========================================================================
// sheetIO_readRange
// ===========================================================================

console.log('\nsheetIO_readRange');

test('returns Table_Array with ["RANGE"] header from active selection', function () {
  const mockApp = createMockSpreadsheetApp({});
  mockApp._setActiveRange([
    ['col1', 'col2'],
    ['a', 'b'],
    ['c', 'd'],
  ]);
  const io = loadSheetIO(mockApp);

  const result = io.sheetIO_readRange();
  assert.strictEqual(result.length, 4);
  assert.strictEqual(result[0][0], 'RANGE');
  assert.strictEqual(result[0].length, 1);
  assert.deepStrictEqual(result[1], ['col1', 'col2']);
  assert.deepStrictEqual(result[2], ['a', 'b']);
  assert.deepStrictEqual(result[3], ['c', 'd']);
});

// ===========================================================================
// sheetIO_writeRows
// ===========================================================================

console.log('\nsheetIO_writeRows');

test('writes rows using a single setValues call (batched)', function () {
  const mockApp = createMockSpreadsheetApp({
    target: [['id', 'name']],
  });
  const io = loadSheetIO(mockApp);

  // Track setValues calls
  let setValuesCalls = 0;
  const sheet = mockApp._spreadsheet._sheets['target'];
  const origGetRange = sheet.getRange;
  sheet.getRange = function (row, col, numRows, numCols) {
    const range = origGetRange.call(sheet, row, col, numRows, numCols);
    const origSetValues = range.setValues;
    range.setValues = function (vals) {
      setValuesCalls++;
      return origSetValues.call(range, vals);
    };
    return range;
  };

  io.sheetIO_writeRows('target', [[1, 'Alice'], [2, 'Bob']]);

  assert.strictEqual(setValuesCalls, 1, 'setValues should be called exactly once');
  const values = sheet._getValues();
  assert.strictEqual(values.length, 3); // header + 2 data rows
  assert.deepStrictEqual(values[1], [1, 'Alice']);
  assert.deepStrictEqual(values[2], [2, 'Bob']);
});

// ===========================================================================
// sheetIO_deleteRows
// ===========================================================================

console.log('\nsheetIO_deleteRows');

test('deletes rows in descending order to preserve indices', function () {
  const mockApp = createMockSpreadsheetApp({
    data: [
      ['id', 'name'],
      [1, 'Alice'],
      [2, 'Bob'],
      [3, 'Carol'],
      [4, 'Dave'],
    ],
  });
  const io = loadSheetIO(mockApp);

  // Track deletion order
  const deletedIndices = [];
  const sheet = mockApp._spreadsheet._sheets['data'];
  const origDeleteRow = sheet.deleteRow;
  sheet.deleteRow = function (idx) {
    deletedIndices.push(idx);
    return origDeleteRow.call(sheet, idx);
  };

  // Delete rows 2 and 4 (1-based: row 2 = [1,'Alice'], row 4 = [3,'Carol'])
  io.sheetIO_deleteRows('data', [2, 4]);

  // Should delete in descending order: 4 first, then 2
  assert.deepStrictEqual(deletedIndices, [4, 2]);

  const values = sheet._getValues();
  assert.strictEqual(values.length, 3); // header + 2 remaining rows
  assert.deepStrictEqual(values[0], ['id', 'name']);
  assert.deepStrictEqual(values[1], [2, 'Bob']);
  assert.deepStrictEqual(values[2], [4, 'Dave']);
});

// ===========================================================================
// sheetIO_updateCells
// ===========================================================================

console.log('\nsheetIO_updateCells');

test('updates cells using batched setValues per row', function () {
  const mockApp = createMockSpreadsheetApp({
    emp: [
      ['id', 'name', 'salary'],
      [1, 'Alice', 80000],
      [2, 'Bob', 60000],
    ],
  });
  const io = loadSheetIO(mockApp);

  // Track setValues calls
  let setValuesCalls = 0;
  const sheet = mockApp._spreadsheet._sheets['emp'];
  const origGetRange = sheet.getRange;
  sheet.getRange = function (row, col, numRows, numCols) {
    const range = origGetRange.call(sheet, row, col, numRows, numCols);
    const origSetValues = range.setValues;
    range.setValues = function (vals) {
      setValuesCalls++;
      return origSetValues.call(range, vals);
    };
    return range;
  };

  io.sheetIO_updateCells('emp', [
    { row: 2, col: 3, value: 90000 },
    { row: 3, col: 2, value: 'Robert' },
  ]);

  // Should use setValues (batched), not individual setValue
  assert.ok(setValuesCalls >= 1, 'setValues should be called at least once');

  const values = sheet._getValues();
  assert.strictEqual(values[1][2], 90000);
  assert.strictEqual(values[2][1], 'Robert');
});

test('handles empty updates array gracefully', function () {
  const mockApp = createMockSpreadsheetApp({ emp: [['id']] });
  const io = loadSheetIO(mockApp);
  // Should not throw
  io.sheetIO_updateCells('emp', []);
});

// ===========================================================================
// sheetIO_createSheet
// ===========================================================================

console.log('\nsheetIO_createSheet');

test('creates a new sheet with bold column headers', function () {
  const mockApp = createMockSpreadsheetApp({});
  const io = loadSheetIO(mockApp);

  io.sheetIO_createSheet('products', ['id', 'name', 'price']);

  const sheet = mockApp._spreadsheet._sheets['products'];
  assert.ok(sheet, 'Sheet should be created');
  const values = sheet._getValues();
  assert.deepStrictEqual(values[0], ['id', 'name', 'price']);
});

test('creates a sheet without columns when none provided', function () {
  const mockApp = createMockSpreadsheetApp({});
  const io = loadSheetIO(mockApp);

  io.sheetIO_createSheet('empty_table');

  const sheet = mockApp._spreadsheet._sheets['empty_table'];
  assert.ok(sheet, 'Sheet should be created');
  assert.strictEqual(sheet._getValues().length, 0);
});

test('throws "Table already exists: X" when sheet exists', function () {
  const mockApp = createMockSpreadsheetApp({ existing: [['id']] });
  const io = loadSheetIO(mockApp);

  assertThrowsMessage(
    function () { io.sheetIO_createSheet('existing', ['id']); },
    'Table already exists: existing'
  );
});

// ===========================================================================
// sheetIO_deleteSheet
// ===========================================================================

console.log('\nsheetIO_deleteSheet');

test('deletes an existing sheet', function () {
  const mockApp = createMockSpreadsheetApp({ toDelete: [['id']] });
  const io = loadSheetIO(mockApp);

  io.sheetIO_deleteSheet('toDelete');

  assert.strictEqual(mockApp._spreadsheet._sheets['toDelete'], undefined);
});

test('throws "Invalid sheet : X" when sheet does not exist', function () {
  const mockApp = createMockSpreadsheetApp({});
  const io = loadSheetIO(mockApp);

  assertThrowsMessage(
    function () { io.sheetIO_deleteSheet('ghost'); },
    'Invalid sheet : ghost'
  );
});

// ===========================================================================
// sheetIO_addColumn
// ===========================================================================

console.log('\nsheetIO_addColumn');

test('adds a column to the header row', function () {
  const mockApp = createMockSpreadsheetApp({
    tbl: [['id', 'name']],
  });
  const io = loadSheetIO(mockApp);

  io.sheetIO_addColumn('tbl', 'email');

  const sheet = mockApp._spreadsheet._sheets['tbl'];
  const values = sheet._getValues();
  assert.strictEqual(values[0][2], 'email');
});

test('throws when column already exists', function () {
  const mockApp = createMockSpreadsheetApp({
    tbl: [['id', 'name']],
  });
  const io = loadSheetIO(mockApp);

  assertThrowsMessage(
    function () { io.sheetIO_addColumn('tbl', 'name'); },
    'The column already exists!'
  );
});

test('throws when sheet does not exist for addColumn', function () {
  const mockApp = createMockSpreadsheetApp({});
  const io = loadSheetIO(mockApp);

  assertThrowsMessage(
    function () { io.sheetIO_addColumn('nope', 'col'); },
    'Invalid sheet : nope'
  );
});

// ===========================================================================
// sheetIO_dropColumn
// ===========================================================================

console.log('\nsheetIO_dropColumn');

test('removes a column from the sheet', function () {
  const mockApp = createMockSpreadsheetApp({
    tbl: [
      ['id', 'name', 'email'],
      [1, 'Alice', 'a@b.com'],
    ],
  });
  const io = loadSheetIO(mockApp);

  // Track deleteColumn calls
  let deletedCol = null;
  const sheet = mockApp._spreadsheet._sheets['tbl'];
  sheet.deleteColumn = function (colIndex) {
    deletedCol = colIndex;
    // Remove column from each row
    const vals = sheet._getValues();
    for (let r = 0; r < vals.length; r++) {
      vals[r].splice(colIndex - 1, 1);
    }
  };

  io.sheetIO_dropColumn('tbl', 'name');

  assert.strictEqual(deletedCol, 2); // 'name' is at 1-based index 2
});

test('throws when column does not exist for dropColumn', function () {
  const mockApp = createMockSpreadsheetApp({
    tbl: [['id', 'name']],
  });
  const io = loadSheetIO(mockApp);

  assertThrowsMessage(
    function () { io.sheetIO_dropColumn('tbl', 'missing'); },
    'The column does not exist!'
  );
});

test('throws when sheet does not exist for dropColumn', function () {
  const mockApp = createMockSpreadsheetApp({});
  const io = loadSheetIO(mockApp);

  assertThrowsMessage(
    function () { io.sheetIO_dropColumn('nope', 'col'); },
    'Invalid sheet : nope'
  );
});

// ===========================================================================
// sheetIO_getOrCreateSqlSheet
// ===========================================================================

console.log('\nsheetIO_getOrCreateSqlSheet');

test('returns existing SQL sheet if present', function () {
  const mockApp = createMockSpreadsheetApp({ SQL: [['query']] });
  const io = loadSheetIO(mockApp);

  const sheet = io.sheetIO_getOrCreateSqlSheet();
  assert.strictEqual(sheet.getName(), 'SQL');
});

test('creates SQL sheet if not present', function () {
  const mockApp = createMockSpreadsheetApp({});
  const io = loadSheetIO(mockApp);

  const sheet = io.sheetIO_getOrCreateSqlSheet();
  assert.strictEqual(sheet.getName(), 'SQL');
  assert.ok(mockApp._spreadsheet._sheets['SQL'], 'SQL sheet should exist');
});

// ===========================================================================
// sheetIO_appendOutputRows
// ===========================================================================

console.log('\nsheetIO_appendOutputRows');

test('appends rows using batched setValues with normalized widths', function () {
  const mockApp = createMockSpreadsheetApp({ SQL: [] });
  const io = loadSheetIO(mockApp);

  const sheet = mockApp._spreadsheet._sheets['SQL'];

  // Track setValues calls
  let setValuesCalls = 0;
  const origGetRange = sheet.getRange;
  sheet.getRange = function (row, col, numRows, numCols) {
    const range = origGetRange.call(sheet, row, col, numRows, numCols);
    const origSetValues = range.setValues;
    range.setValues = function (vals) {
      setValuesCalls++;
      return origSetValues.call(range, vals);
    };
    return range;
  };

  io.sheetIO_appendOutputRows(sheet, [
    ['SELECT * FROM t success'],
    ['id', 'name'],
    ['1', 'Alice'],
  ]);

  assert.strictEqual(setValuesCalls, 1, 'setValues should be called exactly once');

  const values = sheet._getValues();
  // Rows should be normalized to max width (2 columns)
  assert.deepStrictEqual(values[0], ['SELECT * FROM t success', '']);
  assert.deepStrictEqual(values[1], ['id', 'name']);
  assert.deepStrictEqual(values[2], ['1', 'Alice']);
});

test('handles empty rows array gracefully', function () {
  const mockApp = createMockSpreadsheetApp({ SQL: [] });
  const io = loadSheetIO(mockApp);
  const sheet = mockApp._spreadsheet._sheets['SQL'];
  // Should not throw
  io.sheetIO_appendOutputRows(sheet, []);
});

// ===========================================================================
// Summary
// ===========================================================================

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All SheetIO tests passed');
}
