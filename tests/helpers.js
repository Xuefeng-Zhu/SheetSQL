'use strict';

const assert = require('assert');

// ---------------------------------------------------------------------------
// Table_Array factory functions
// ---------------------------------------------------------------------------

/**
 * Create a Table_Array from parts.
 * Table_Array format:
 *   row 0 = [tableName]
 *   row 1 = column headers
 *   row 2+ = data rows
 *
 * @param {string} tableName
 * @param {string[]} headers - column names
 * @param {Array<Array>} [rows] - data rows (default: empty)
 * @returns {Array<Array>} Table_Array
 */
function makeTable(tableName, headers, rows) {
  const table = [[tableName], headers.slice()];
  if (rows) {
    for (let i = 0; i < rows.length; i++) {
      table.push(rows[i].slice());
    }
  }
  return table;
}

/**
 * Create a simple employees Table_Array for quick tests.
 * Columns: id, name, dept, salary
 */
function makeEmployeesTable() {
  return makeTable('employees', ['id', 'name', 'dept', 'salary'], [
    [1, 'Alice', 'Engineering', 80000],
    [2, 'Bob', 'Sales', 60000],
    [3, 'Carol', 'Engineering', 90000],
    [4, 'Dave', 'Marketing', 70000],
    [5, 'Eve', 'Sales', 65000],
  ]);
}

/**
 * Create a departments Table_Array for join tests.
 * Columns: dept_name, location
 */
function makeDepartmentsTable() {
  return makeTable('departments', ['dept_name', 'location'], [
    ['Engineering', 'Building A'],
    ['Sales', 'Building B'],
    ['Marketing', 'Building C'],
  ]);
}

/**
 * Create an empty Table_Array (headers only, no data rows).
 */
function makeEmptyTable(tableName, headers) {
  return makeTable(tableName, headers, []);
}

// ---------------------------------------------------------------------------
// SpreadsheetApp mock factory
// ---------------------------------------------------------------------------

/**
 * Create a mock SpreadsheetApp that simulates the Google Sheets API.
 *
 * @param {Object<string, Array<Array>>} [sheetData] - map of sheet name → 2D
 *   array of cell values (including header row). Example:
 *   { employees: [['id','name'], [1,'Alice'], [2,'Bob']] }
 * @returns {object} mock SpreadsheetApp
 */
function createMockSpreadsheetApp(sheetData) {
  const sheets = {};

  // Initialise sheets from provided data
  if (sheetData) {
    for (const name of Object.keys(sheetData)) {
      sheets[name] = createMockSheet(name, sheetData[name]);
    }
  }

  let activeRangeValues = null;

  const spreadsheet = {
    getSheetByName: function (name) {
      return sheets[name] || null;
    },
    insertSheet: function (name) {
      if (sheets[name]) {
        throw new Error('Table already exists: ' + name);
      }
      sheets[name] = createMockSheet(name, []);
      return sheets[name];
    },
    deleteSheet: function (sheet) {
      for (const name of Object.keys(sheets)) {
        if (sheets[name] === sheet) {
          delete sheets[name];
          return;
        }
      }
    },
    getActiveRange: function () {
      return createMockRange(activeRangeValues || []);
    },
    getActive: function () {
      return spreadsheet;
    },
    getUi: function () {
      return createMockUi();
    },
    // Expose internal sheets map for test assertions
    _sheets: sheets,
  };

  const mockApp = {
    getActiveSpreadsheet: function () {
      return spreadsheet;
    },
    getActiveRange: function () {
      return spreadsheet.getActiveRange();
    },
    getActive: function () {
      return spreadsheet;
    },
    getUi: function () {
      return createMockUi();
    },
    // Test helper: set the active range values
    _setActiveRange: function (values) {
      activeRangeValues = values;
    },
    // Test helper: access the underlying spreadsheet
    _spreadsheet: spreadsheet,
  };

  return mockApp;
}

/**
 * Create a mock Sheet object.
 * @param {string} name
 * @param {Array<Array>} data - 2D array of cell values
 */
function createMockSheet(name, data) {
  // Deep-copy data so mutations don't leak
  let values = data.map(function (row) { return row.slice(); });

  const sheet = {
    getName: function () { return name; },

    getDataRange: function () {
      return createMockRange(values);
    },

    getValues: function () {
      return values.map(function (row) { return row.slice(); });
    },

    setValues: function (newValues) {
      values = newValues.map(function (row) { return row.slice(); });
    },

    getRange: function (row, col, numRows, numCols) {
      // 1-based row/col
      return createMockCellRange(values, row, col, numRows, numCols);
    },

    appendRow: function (rowData) {
      values.push(rowData.slice());
    },

    deleteRow: function (rowIndex) {
      // 1-based index
      values.splice(rowIndex - 1, 1);
    },

    getLastRow: function () {
      return values.length;
    },

    getLastColumn: function () {
      if (values.length === 0) return 0;
      return Math.max.apply(null, values.map(function (r) { return r.length; }));
    },

    getNumRows: function () {
      return values.length;
    },

    clear: function () {
      values = [];
    },

    activate: function () {
      return sheet;
    },

    isBlank: function () {
      return values.length === 0;
    },

    // Test helper: read internal values
    _getValues: function () {
      return values;
    },
  };

  return sheet;
}

/**
 * Create a mock Range object for getDataRange().
 */
function createMockRange(values) {
  return {
    getValues: function () {
      return values.map(function (row) { return row.slice(); });
    },
    getNumRows: function () {
      return values.length;
    },
    getNumColumns: function () {
      if (values.length === 0) return 0;
      return values[0].length;
    },
    setValues: function (newValues) {
      // Replace in-place for the mock
      values.length = 0;
      for (let i = 0; i < newValues.length; i++) {
        values.push(newValues[i].slice());
      }
    },
    setValue: function (val) {
      if (values.length === 0) values.push([]);
      values[0][0] = val;
    },
    getValue: function () {
      if (values.length === 0 || values[0].length === 0) return '';
      return values[0][0];
    },
    setFontWeight: function () {
      // no-op for mock
    },
    isBlank: function () {
      return values.length === 0;
    },
  };
}

/**
 * Create a mock Range for getRange(row, col, numRows, numCols).
 * row and col are 1-based.
 */
function createMockCellRange(sheetValues, startRow, startCol, numRows, numCols) {
  return {
    getValues: function () {
      const result = [];
      for (let r = startRow - 1; r < startRow - 1 + (numRows || 1); r++) {
        const row = [];
        for (let c = startCol - 1; c < startCol - 1 + (numCols || 1); c++) {
          row.push(sheetValues[r] && sheetValues[r][c] !== undefined ? sheetValues[r][c] : '');
        }
        result.push(row);
      }
      return result;
    },
    setValues: function (newValues) {
      for (let r = 0; r < newValues.length; r++) {
        const sheetRow = startRow - 1 + r;
        while (sheetValues.length <= sheetRow) sheetValues.push([]);
        for (let c = 0; c < newValues[r].length; c++) {
          const sheetCol = startCol - 1 + c;
          while (sheetValues[sheetRow].length <= sheetCol) sheetValues[sheetRow].push('');
          sheetValues[sheetRow][sheetCol] = newValues[r][c];
        }
      }
    },
    setValue: function (val) {
      const sheetRow = startRow - 1;
      while (sheetValues.length <= sheetRow) sheetValues.push([]);
      const sheetCol = startCol - 1;
      while (sheetValues[sheetRow].length <= sheetCol) sheetValues[sheetRow].push('');
      sheetValues[sheetRow][sheetCol] = val;
    },
    getValue: function () {
      const r = startRow - 1;
      const c = startCol - 1;
      if (sheetValues[r] && sheetValues[r][c] !== undefined) return sheetValues[r][c];
      return '';
    },
    setFontWeight: function () {
      // no-op
    },
    isBlank: function () {
      const r = startRow - 1;
      const c = startCol - 1;
      return !(sheetValues[r] && sheetValues[r][c]);
    },
    getNumRows: function () {
      return numRows || 1;
    },
  };
}

/**
 * Create a mock UI object.
 */
function createMockUi() {
  return {
    Button: { OK: 'OK', YES: 'YES', NO: 'NO', CANCEL: 'CANCEL' },
    ButtonSet: { OK_CANCEL: 'OK_CANCEL', YES_NO: 'YES_NO' },
    createMenu: function () {
      return {
        addItem: function () { return this; },
        addToUi: function () {},
      };
    },
    alert: function () { return 'YES'; },
    prompt: function () {
      return {
        getSelectedButton: function () { return 'OK'; },
        getResponseText: function () { return ''; },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Assert two Table_Arrays are deeply equal.
 * Provides a clear diff message on failure.
 */
function assertTablesEqual(actual, expected, message) {
  const prefix = message ? message + ': ' : '';
  assert.strictEqual(
    actual.length,
    expected.length,
    prefix + 'row count mismatch (actual ' + actual.length + ' vs expected ' + expected.length + ')'
  );
  for (let i = 0; i < expected.length; i++) {
    assert.deepStrictEqual(
      actual[i],
      expected[i],
      prefix + 'row ' + i + ' mismatch'
    );
  }
}

/**
 * Assert that a Table_Array has the expected table name.
 */
function assertTableName(table, expectedName) {
  assert.ok(Array.isArray(table) && table.length >= 1, 'Table must have at least a name row');
  assert.deepStrictEqual(table[0], [expectedName], 'Table name mismatch');
}

/**
 * Assert that a Table_Array has the expected column headers.
 */
function assertTableHeaders(table, expectedHeaders) {
  assert.ok(Array.isArray(table) && table.length >= 2, 'Table must have at least name + header rows');
  assert.deepStrictEqual(table[1], expectedHeaders, 'Header mismatch');
}

/**
 * Assert that a Table_Array has the expected number of data rows.
 */
function assertRowCount(table, expectedCount) {
  const actualCount = Math.max(0, table.length - 2);
  assert.strictEqual(actualCount, expectedCount, 'Data row count mismatch');
}

/**
 * Get only the data rows from a Table_Array (skip name + header rows).
 */
function getDataRows(table) {
  return table.slice(2);
}

/**
 * Get the column headers from a Table_Array.
 */
function getHeaders(table) {
  return table[1];
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Table_Array factories
  makeTable,
  makeEmployeesTable,
  makeDepartmentsTable,
  makeEmptyTable,

  // SpreadsheetApp mock
  createMockSpreadsheetApp,
  createMockSheet,
  createMockRange,

  // Assertion helpers
  assertTablesEqual,
  assertTableName,
  assertTableHeaders,
  assertRowCount,
  getDataRows,
  getHeaders,
};
