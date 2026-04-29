/**
 * Sheet_IO — the only layer that touches SpreadsheetApp.
 * Provides batched read/write primitives for the SQL engine.
 */

// -------------------------------------------------------------------------
// Read operations
// -------------------------------------------------------------------------

/**
 * Read an entire sheet as a Table_Array.
 * Row 0 = [sheetName], Row 1 = column headers, Row 2+ = data.
 *
 * @param {string} name - sheet name
 * @returns {Array<Array>} Table_Array
 * @throws {Error} "Invalid sheet : {name}" if sheet doesn't exist
 * @throws {Error} "Sheet should atleast have a header" if sheet is empty
 */
function sheetIO_readTable(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) {
    throw new Error("Invalid sheet : " + name);
  }

  var range = sheet.getDataRange();
  var numRows = range.getNumRows();
  var values = range.getValues();

  if (numRows < 1) {
    throw new Error("Sheet should atleast have a header");
  }

  var out = [];
  out.push([name]);
  for (var i = 0; i < values.length; i++) {
    out.push(values[i]);
  }
  return out;
}

/**
 * Read the currently selected range as a Table_Array.
 * Row 0 = ["RANGE"], Row 1 = first row (headers), Row 2+ = data.
 *
 * @returns {Array<Array>} Table_Array
 */
function sheetIO_readRange() {
  var values = SpreadsheetApp.getActiveRange().getValues();
  var out = [];
  out.push(["RANGE"]);
  for (var i = 0; i < values.length; i++) {
    out.push(values[i]);
  }
  return out;
}

// -------------------------------------------------------------------------
// Write operations
// -------------------------------------------------------------------------

/**
 * Write a 2D array to a target sheet using a single setValues call.
 *
 * @param {string} sheetName
 * @param {Array<Array>} rows - 2D array of values
 */
function sheetIO_writeRows(sheetName, rows) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
}

/**
 * Delete specified row indices from a sheet.
 * Deletes in descending order to preserve correct indices.
 *
 * @param {string} sheetName
 * @param {Array<number>} rowIndices - 1-based sheet row indices, sorted ascending
 */
function sheetIO_deleteRows(sheetName, rowIndices) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  // Sort descending so that deleting a later row doesn't shift earlier indices
  var sorted = rowIndices.slice().sort(function (a, b) { return b - a; });
  for (var i = 0; i < sorted.length; i++) {
    sheet.deleteRow(sorted[i]);
  }
}

/**
 * Write changed cell values using batched setValues.
 * Each update is {row, col, value} with 1-based positions.
 *
 * @param {string} sheetName
 * @param {Array<{row: number, col: number, value: *}>} updates - 1-based row/col positions
 */
function sheetIO_updateCells(sheetName, updates) {
  if (!updates || updates.length === 0) {
    return;
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  // Group updates by row for batched writes
  var byRow = {};
  for (var i = 0; i < updates.length; i++) {
    var u = updates[i];
    if (!byRow[u.row]) {
      byRow[u.row] = [];
    }
    byRow[u.row].push(u);
  }

  var rowKeys = Object.keys(byRow);
  for (var r = 0; r < rowKeys.length; r++) {
    var rowNum = Number(rowKeys[r]);
    var cells = byRow[rowNum];
    // Find min and max column to create a contiguous range
    var minCol = cells[0].col;
    var maxCol = cells[0].col;
    for (var c = 1; c < cells.length; c++) {
      if (cells[c].col < minCol) minCol = cells[c].col;
      if (cells[c].col > maxCol) maxCol = cells[c].col;
    }
    var numCols = maxCol - minCol + 1;
    // Read current values for the range
    var range = sheet.getRange(rowNum, minCol, 1, numCols);
    var vals = range.getValues();
    // Apply updates
    for (var c = 0; c < cells.length; c++) {
      vals[0][cells[c].col - minCol] = cells[c].value;
    }
    range.setValues(vals);
  }
}

// -------------------------------------------------------------------------
// DDL operations
// -------------------------------------------------------------------------

/**
 * Create a new sheet with optional bold column headers.
 *
 * @param {string} sheetName
 * @param {Array<string>} [columns] - optional header names
 * @throws {Error} "Table already exists: {name}" if sheet exists
 */
function sheetIO_createSheet(sheetName, columns) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName(sheetName)) {
    throw new Error("Table already exists: " + sheetName);
  }

  var sheet = ss.insertSheet(sheetName);
  if (columns && columns.length > 0) {
    var headerRange = sheet.getRange(1, 1, 1, columns.length);
    headerRange.setValues([columns]);
    headerRange.setFontWeight("bold");
  }
}

/**
 * Delete a sheet by name.
 *
 * @param {string} sheetName
 * @throws {Error} "Invalid sheet : {name}" if sheet doesn't exist
 */
function sheetIO_deleteSheet(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Invalid sheet : " + sheetName);
  }
  ss.deleteSheet(sheet);
}

/**
 * Add a column to a sheet's header row.
 *
 * @param {string} sheetName
 * @param {string} columnName
 * @throws {Error} if sheet doesn't exist
 * @throws {Error} if column already exists
 */
function sheetIO_addColumn(sheetName, columnName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Invalid sheet : " + sheetName);
  }

  var lastCol = sheet.getLastColumn();
  var headers = [];
  if (lastCol > 0) {
    headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  }

  for (var i = 0; i < headers.length; i++) {
    if (headers[i] === columnName) {
      throw new Error("The column already exists!");
    }
  }

  var nextCol = lastCol + 1;
  var cell = sheet.getRange(1, nextCol);
  cell.setValue(columnName);
  cell.setFontWeight("bold");
}

/**
 * Remove a column from a sheet.
 *
 * @param {string} sheetName
 * @param {string} columnName
 * @throws {Error} if sheet doesn't exist
 * @throws {Error} if column doesn't exist
 */
function sheetIO_dropColumn(sheetName, columnName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Invalid sheet : " + sheetName);
  }

  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) {
    throw new Error("The column does not exist!");
  }

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var colIndex = -1;
  for (var i = 0; i < headers.length; i++) {
    if (headers[i] === columnName) {
      colIndex = i + 1; // 1-based
      break;
    }
  }

  if (colIndex === -1) {
    throw new Error("The column does not exist!");
  }

  sheet.deleteColumn(colIndex);
}

// -------------------------------------------------------------------------
// History sheet management
// -------------------------------------------------------------------------

/**
 * Get or create the SQL history sheet.
 *
 * @returns {Sheet}
 */
function sheetIO_getOrCreateSqlSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SQL_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SQL_SHEET_NAME);
  }
  return sheet;
}

/**
 * Append output rows to a sheet using batched setValues.
 * Normalizes row widths before writing.
 *
 * @param {Sheet} sheet
 * @param {Array<Array>} rows
 */
function sheetIO_appendOutputRows(sheet, rows) {
  if (!rows || rows.length === 0) {
    return;
  }

  // Normalize row widths to the maximum width
  var maxCols = 0;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].length > maxCols) {
      maxCols = rows[i].length;
    }
  }

  var normalized = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i].slice();
    while (row.length < maxCols) {
      row.push("");
    }
    normalized.push(row);
  }

  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, normalized.length, normalized[0].length)
       .setValues(normalized);
}
