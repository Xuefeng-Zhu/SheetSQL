var SQL_SHEET_NAME = 'SQL';
var SQL_SUCCESS_SUFFIX = ' success';
var SQL_MENU_NAME = 'SQL';
var SQL_MAX_QUERY_LENGTH = 50000;

function onOpen(e) {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu(SQL_MENU_NAME)
      .addItem('Show prompt', 'showPrompt')
      .addItem('Clear History', 'warning')
      .addToUi();
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
  var sheet = getOrCreateSqlSheet();
  sheet.activate();

  if (outputRows && outputRows.length > 0) {
    appendOutputRows_(sheet, outputRows);
  }
  sheet.appendRow([' ']);
}


function appendOutputRows_(sheet, outputRows) {
  var normalizedRows = normalizeRows_(outputRows);
  sheet.getRange(sheet.getLastRow() + 1, 1, normalizedRows.length, normalizedRows[0].length)
      .setValues(normalizedRows);
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
    var sheet = getOrCreateSqlSheet();
    sheet.clear();
    ui.alert('History cleared.');
    return;
  }

  ui.alert('User canceled.');
}

function getOrCreateSqlSheet() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(SQL_SHEET_NAME);
  if (sheet === null) {
    sheet = spreadsheet.insertSheet(SQL_SHEET_NAME);
  }
  return sheet;
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

function executeStatement(statement, handler) {
  try {
    var output = [[statement + SQL_SUCCESS_SUFFIX]];
    var result = handler.execute(statement);

    if (handler.withSelectResult) {
      output = output.concat(result || []);
    }

    return output;
  } catch (err) {
    return [['Query failed: ' + err.message]];
  }
}
