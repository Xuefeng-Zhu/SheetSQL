function createTable(input) {
  var match = /^CREATE\s+TABLE\s+([A-Za-z0-9_]+)(?:\s*\(([^)]*)\))?\s*;?$/i.exec(String(input || ''));
  if (!match) {
    throw 'Invalid CREATE TABLE syntax';
  }

  var tableName = match[1];
  var attrs = parseAttributeList_(match[2]);
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (ss.getSheetByName(tableName)) {
    throw 'Table already exists: ' + tableName;
  }

  var sheet = ss.insertSheet(tableName, ss.getNumSheets());
  if (attrs.length > 0) {
    sheet.appendRow(attrs);
    sheet.getRange(1, 1, 1, attrs.length).setFontWeight('bold');
  }
}

function dropTable(input)
{
  var match = /^DROP\s+TABLE\s+([A-Za-z0-9_]+)\s*;?$/i.exec(String(input || ''));
  if (!match) {
    throw 'Invalid DROP TABLE syntax';
  }

  var tableName = match[1];
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(tableName);
  if (!sheet) {
    throw 'Invalid sheet : ' + tableName;
  }
  ss.deleteSheet(sheet);
}

function alterTable(input)
{
  var match = /^ALTER\s+TABLE\s+([A-Za-z0-9_]+)\s+(ADD|DROP)\s+([A-Za-z0-9_]+)\s*;?$/i.exec(String(input || ''));
  if (!match) {
    throw 'Invalid ALTER TABLE syntax';
  }

  var tableName = match[1];
  var operation = match[2].toUpperCase();
  var column = match[3];
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(tableName);
  if (!sheet) {
    throw 'Invalid sheet : ' + tableName;
  }

  if (operation === 'ADD')
  {
    var existingColumns = getHeaderValues_(sheet);
    for (var i = 0; i < existingColumns.length; i++) {
      if (existingColumns[i] === column) {
        throw 'The column already exists!';
      }
    }
    var nextColumnIndex = existingColumns.length + 1;
    var headerCell = sheet.getRange(1, nextColumnIndex);
    headerCell.setValue(column);
    headerCell.setFontWeight('bold');
    return;
  }

  var dropColumnIndex = getColumnIndex_(sheet, column);
  if (dropColumnIndex === -1)
    throw 'The column does not exist!';

  sheet.deleteColumn(dropColumnIndex);
}

function parseAttributeList_(rawAttrs) {
  if (!rawAttrs) {
    return [];
  }

  var attrs = rawAttrs.split(',');
  var out = [];
  for (var i = 0; i < attrs.length; i++) {
    var attr = attrs[i].replace(/^\s+|\s+$/g, '');
    if (!attr) {
      throw 'Invalid attribute list';
    }
    out.push(attr);
  }
  return out;
}

function getColumnIndex_(sheet, columnName) {
  var headerValues = getHeaderValues_(sheet);
  for (var i = 0; i < headerValues.length; i++) {
    if (headerValues[i] === columnName) {
      return i + 1;
    }
  }
  return -1;
}

function getHeaderValues_(sheet) {
  var lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) {
    return [];
  }

  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var out = [];
  for (var i = 0; i < headers.length; i++) {
    if (headers[i] === '') {
      break;
    }
    out.push(headers[i]);
  }
  return out;
}
