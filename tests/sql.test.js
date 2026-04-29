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
    update: () => null
  };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox;
}

(function run() {
  const sql = loadSqlModule();

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

  console.log('All tests passed');
})();
