var SQL_SHEET_NAME = 'SQL';
var SQL_SUCCESS_SUFFIX = ' success';

function onOpen() {
  var ss = SpreadsheetApp.getActive();
  var items = [
    {name: 'Show prompt', functionName: 'showPrompt'},
    {name: 'Clear History', functionName: 'warning'}
  ];
  ss.addMenu('SQL', items);
}

function showPrompt() {
  var result = Browser.inputBox(
      'Google Sheet based SQL',
      'Please enter SQL statement you want to execute:',
      Browser.Buttons.OK_CANCEL);

  if (result === 'cancel') {
    Browser.msgBox('Thanks for using! Bye!');
    return;
  }

  var outputRows = SQL(result);
  var sheet = getOrCreateSqlSheet();
  sheet.activate();

  for (var i = 0; i < outputRows.length; i++) {
    sheet.appendRow(outputRows[i]);
  }
  sheet.appendRow([' ']);
}

function warning() {
  var result = Browser.msgBox(
      'Please confirm',
      'Are you sure you want to clear all the history?',
      Browser.Buttons.YES_NO);

  if (result === 'yes') {
    var sheet = SpreadsheetApp.getActiveSheet();
    sheet.clear();
    Browser.msgBox('History Cleared.');
    return;
  }

  Browser.msgBox('User Canceled.');
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

/*
function eliminateDup(input)
{
  var out = [];
  for (var i = 0; i < input.length; i++)
  {
    var repeat = false;
    for (var j = 0; j < out.length; j++)
      if (input[i].join(" ") == out[j].join(" "))
      {
        repeat = true;
        break;
      }
    if (!repeat)
      out.push(input[i]);
  }
  return out;
}
*/
