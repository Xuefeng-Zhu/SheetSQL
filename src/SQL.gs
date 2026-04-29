var SQL_SHEET_NAME = 'SQL';
var SQL_SUCCESS_SUFFIX = ' success';
var SQL_MENU_NAME = 'SQL';
var SQL_MAX_QUERY_LENGTH = 50000;
var SQL_MENU_ITEMS = [
  {label: 'Show prompt', handler: 'showPrompt'},
  {label: 'Clear History', handler: 'warning'}
];

function onOpen(e) {
  var ui = SpreadsheetApp.getUi();
  var menu = ui.createMenu(SQL_MENU_NAME);
  for (var i = 0; i < SQL_MENU_ITEMS.length; i++) {
    menu.addItem(SQL_MENU_ITEMS[i].label, SQL_MENU_ITEMS[i].handler);
  }
  menu.addToUi();
}

function onInstall(e) {
  onOpen(e);
}

function showPrompt() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
      'Google Sheets based SQL',
      'Please enter SQL statement you want to execute:',
      ui.ButtonSet.OK_CANCEL);

  if (response.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  var query = response.getResponseText();
  var outputRows = SQL(query);
  var sheet = sheetIO_getOrCreateSqlSheet();
  sheet.activate();

  if (outputRows && outputRows.length > 0) {
    sheetIO_appendOutputRows(sheet, outputRows);
  }
  sheet.appendRow([' ']);
}


function appendOutputRows_(sheet, outputRows) {
  sheetIO_appendOutputRows(sheet, outputRows);
}

function normalizeRows_(rows) {
  var maxColumns = 0;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].length > maxColumns) {
      maxColumns = rows[i].length;
    }
  }

  var normalized = [];
  for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    var row = rows[rowIndex].slice();
    while (row.length < maxColumns) {
      row.push('');
    }
    normalized.push(row);
  }

  return normalized;
}

function warning() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.alert(
      'Please confirm',
      'Are you sure you want to clear all the history?',
      ui.ButtonSet.YES_NO);

  if (result === ui.Button.YES) {
    var sheet = sheetIO_getOrCreateSqlSheet();
    sheet.clear();
    ui.alert('History cleared.');
    return;
  }

  ui.alert('User canceled.');
}

/**
* Execute the SQL query
*
* @param {string} Query to be executed
* @return {object} result.
*/
function SQL(input) {
  var statement = normalizeStatement(input);
  if (!statement) {
    return [['Syntax invalid: empty statement']];
  }

  if (statement.length > SQL_MAX_QUERY_LENGTH) {
    return [['Syntax invalid: statement exceeds max length']];
  }

  var statementHandlers = [
    {prefix: 'SELECT', execute: selectQuery, withSelectResult: true},
    {prefix: 'CREATE TABLE', execute: createTable},
    {prefix: 'DROP TABLE', execute: dropTable},
    {prefix: 'ALTER TABLE', execute: alterTable},
    {prefix: 'INSERT INTO', execute: insert},
    {prefix: 'DELETE FROM', execute: deleteFrom},
    {prefix: 'UPDATE', execute: update}
  ];

  var handler = getStatementHandler(statement, statementHandlers);
  if (!handler) {
    return [['Syntax invalid']];
  }

  return executeStatement(statement, handler);
}

function normalizeStatement(input) {
  return String(input || '').replace(/;\s*$/, '').trim();
}

function getStatementHandler(statement, statementHandlers) {
  var upperStatement = statement.toUpperCase();
  for (var i = 0; i < statementHandlers.length; i++) {
    if (upperStatement.indexOf(statementHandlers[i].prefix) === 0) {
      return statementHandlers[i];
    }
  }
  return null;
}

function formatError_(err) {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

function executeStatement(statement, handler) {
  try {
    var output = [[statement + SQL_SUCCESS_SUFFIX]];
    var result = handler.execute(statement);

    if (handler.withSelectResult) {
      output = output.concat(result || []);
    }

    return output;
  } catch (err) {
    return [['Query failed: ' + formatError_(err)]];
  }
}
