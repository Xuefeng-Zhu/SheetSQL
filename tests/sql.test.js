const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadSqlModule() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'SQL.gs'), 'utf8');
  const sandbox = {
    console,
    SpreadsheetApp: {
      getUi: () => ({
        Button: { OK: 'OK', YES: 'YES' },
        ButtonSet: { OK_CANCEL: 'OK_CANCEL', YES_NO: 'YES_NO' },
        createMenu: () => ({ addItem: () => ({ addItem: () => ({ addToUi: () => {} }) }) })
      }),
      getActiveSpreadsheet: () => ({
        getSheetByName: () => null,
        insertSheet: () => ({})
      })
    },
    selectQuery: () => [['h1'], ['v1']],
    createTable: () => null,
    dropTable: () => null,
    alterTable: () => null,
    insert: () => null,
    deleteFrom: () => null,
    update: () => null,
    sheetIO_getOrCreateSqlSheet: () => ({
      activate: () => {},
      appendRow: () => {},
      getLastRow: () => 0,
      clear: () => {},
      getRange: () => ({ setValues: () => {} })
    }),
    sheetIO_appendOutputRows: () => {}
  };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox;
}

(function run() {
  const sql = loadSqlModule();

  // --- Existing tests ---

  assert.strictEqual(sql.normalizeStatement('  SELECT * FROM t;  '), 'SELECT * FROM t');
  assert.strictEqual(sql.normalizeStatement(''), '');

  const handlers = [
    { prefix: 'SELECT', execute: () => null },
    { prefix: 'UPDATE', execute: () => null }
  ];
  assert.strictEqual(sql.getStatementHandler('select * from t', handlers), handlers[0]);
  assert.strictEqual(sql.getStatementHandler('DELETE FROM t', handlers), null);

  const normalized = sql.normalizeRows_([[1, 2], [3], [4, 5, 6]]);
  assert.strictEqual(
      JSON.stringify(normalized),
      JSON.stringify([[1, 2, ''], [3, '', ''], [4, 5, 6]])
  );

  const tooLong = 'SELECT ' + 'a'.repeat(sql.SQL_MAX_QUERY_LENGTH + 1);
  assert.strictEqual(
      JSON.stringify(sql.SQL(tooLong)),
      JSON.stringify([['Syntax invalid: statement exceeds max length']])
  );
  assert.strictEqual(
      JSON.stringify(sql.SQL('SELECT 1')),
      JSON.stringify([['SELECT 1 success'], ['h1'], ['v1']])
  );

  // --- Task 7.5: New tests ---

  // 1. formatError_ with Error objects
  // Note: Error objects must be created inside the VM context for instanceof to work
  var errorResult1 = vm.runInContext(
    'formatError_(new Error("something broke"))',
    sql
  );
  assert.strictEqual(errorResult1, 'something broke');
  var errorResult2 = vm.runInContext(
    'formatError_(new Error(""))',
    sql
  );
  assert.strictEqual(errorResult2, '');

  // 2. formatError_ with string throws (legacy)
  var strResult1 = vm.runInContext(
    'formatError_("Invalid sheet : foo")',
    sql
  );
  assert.strictEqual(strResult1, 'Invalid sheet : foo');
  var strResult2 = vm.runInContext(
    'formatError_("")',
    sql
  );
  assert.strictEqual(strResult2, '');

  // 3. formatError_ with non-string, non-Error values
  var numResult = vm.runInContext('formatError_(42)', sql);
  assert.strictEqual(numResult, '42');
  var nullResult = vm.runInContext('formatError_(null)', sql);
  assert.strictEqual(nullResult, 'null');
  var undefResult = vm.runInContext('formatError_(undefined)', sql);
  assert.strictEqual(undefResult, 'undefined');

  // 4. Backward-compatible output format: success messages end with " success"
  var selectResult = sql.SQL('SELECT 1');
  assert.ok(selectResult[0][0].endsWith(' success'), 'Success message should end with " success"');
  assert.strictEqual(selectResult[0][0], 'SELECT 1 success');

  // 5. Error message format: errors start with "Query failed: "
  var errorHandler = { prefix: 'SELECT', execute: function () { throw new (sql.Error || Error)('test error'); } };
  // Use vm.runInContext to ensure the Error is from the sandbox
  sql._testErrorHandler = { prefix: 'SELECT', execute: null, withSelectResult: false };
  vm.runInContext('_testErrorHandler.execute = function() { throw new Error("test error"); }', sql);
  var errorResult = sql.executeStatement('SELECT bad', sql._testErrorHandler);
  assert.strictEqual(errorResult[0][0], 'Query failed: test error');
  assert.ok(errorResult[0][0].startsWith('Query failed: '), 'Error message should start with "Query failed: "');

  // 6. Error formatting with legacy string throws
  sql._testStringHandler = { prefix: 'SELECT', execute: null, withSelectResult: false };
  vm.runInContext('_testStringHandler.execute = function() { throw "legacy error"; }', sql);
  var stringErrorResult = sql.executeStatement('SELECT bad', sql._testStringHandler);
  assert.strictEqual(stringErrorResult[0][0], 'Query failed: legacy error');

  // 7. appendOutputRows_ delegates to sheetIO_appendOutputRows
  var delegateCalled = false;
  var capturedSheet = null;
  var capturedRows = null;
  var origAppend = sql.sheetIO_appendOutputRows;
  sql.sheetIO_appendOutputRows = function (sheet, rows) {
    delegateCalled = true;
    capturedSheet = sheet;
    capturedRows = rows;
  };
  var mockSheet = { name: 'test' };
  var testRows = [['a', 'b'], ['c', 'd']];
  sql.appendOutputRows_(mockSheet, testRows);
  assert.ok(delegateCalled, 'appendOutputRows_ should delegate to sheetIO_appendOutputRows');
  assert.strictEqual(capturedSheet, mockSheet);
  assert.deepStrictEqual(capturedRows, testRows);
  sql.sheetIO_appendOutputRows = origAppend;

  // 8. Empty/null statement handling
  assert.strictEqual(JSON.stringify(sql.SQL('')), JSON.stringify([['Syntax invalid: empty statement']]));
  assert.strictEqual(JSON.stringify(sql.SQL(null)), JSON.stringify([['Syntax invalid: empty statement']]));
  assert.strictEqual(JSON.stringify(sql.SQL(undefined)), JSON.stringify([['Syntax invalid: empty statement']]));
  assert.strictEqual(JSON.stringify(sql.SQL('   ')), JSON.stringify([['Syntax invalid: empty statement']]));
  assert.strictEqual(JSON.stringify(sql.SQL('  ;  ')), JSON.stringify([['Syntax invalid: empty statement']]));

  // 9. Max query length handling
  var exactMax = 'SELECT ' + 'a'.repeat(sql.SQL_MAX_QUERY_LENGTH - 7);
  assert.strictEqual(exactMax.length, sql.SQL_MAX_QUERY_LENGTH);
  // Should not return "exceeds max length" for exactly max length
  var exactResult = sql.SQL(exactMax);
  assert.ok(exactResult[0][0] !== 'Syntax invalid: statement exceeds max length',
      'Exactly max length should not be rejected');

  var overMax = 'SELECT ' + 'a'.repeat(sql.SQL_MAX_QUERY_LENGTH);
  assert.strictEqual(JSON.stringify(sql.SQL(overMax)), JSON.stringify([['Syntax invalid: statement exceeds max length']]));

  // 10. Unrecognized statement returns "Syntax invalid"
  assert.strictEqual(JSON.stringify(sql.SQL('TRUNCATE TABLE foo')), JSON.stringify([['Syntax invalid']]));

  // 11. normalizeRows_ preserves single-column rows
  var singleCol = sql.normalizeRows_([['a'], ['b']]);
  assert.strictEqual(JSON.stringify(singleCol), JSON.stringify([['a'], ['b']]));

  // 12. normalizeRows_ handles empty input
  var emptyNorm = sql.normalizeRows_([]);
  assert.strictEqual(JSON.stringify(emptyNorm), JSON.stringify([]));

  console.log('All tests passed');
})();
