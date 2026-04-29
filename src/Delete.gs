/**
 * Execute a DELETE FROM statement.
 *
 * Parses with simpleSqlParser, plans with planDelete, finds matching rows
 * using Where.gs functions, and delegates row removal to Sheet_IO.
 *
 * @param {string} input - SQL DELETE statement
 */
function deleteFrom(input) {
  var ast = simpleSqlParser.sql2ast(input);
  var plan = planDelete(ast);

  // Read the table
  var tableArray = sheetIO_readTable(plan.table);

  // Get matching row indices using Where.gs (handles simpleSqlParser WHERE format)
  // Need to normalize WHERE values (strip quotes, convert numbers) for comparison
  var normalizedWhere = normalizeSimpleWhere_(plan.where);
  var rows = resolveRowsFromWhere_(tableArray, normalizedWhere, selectRowsByComparison_);

  // Convert tableArray indices to 1-based sheet row indices
  // tableArray: row 0 = [tableName] (not in sheet), row 1 = headers (sheet row 1), row 2+ = data (sheet row 2+)
  // So tableArray index i corresponds to sheet row i
  var sheetRowIndices = [];
  for (var i = 0; i < rows.length; i++) {
    sheetRowIndices.push(rows[i]);
  }

  sheetIO_deleteRows(plan.table, sheetRowIndices);
}
