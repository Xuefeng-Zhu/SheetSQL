/**
 * Execute an INSERT INTO statement.
 *
 * Parses with simpleSqlParser, plans with planInsert, validates columns,
 * and delegates the row write to Sheet_IO.
 *
 * @param {string} input - SQL INSERT statement
 */
function insert(input) {
  var ast = simpleSqlParser.sql2ast(input);
  var plan = planInsert(ast);

  // Read the table to get column headers
  var tableArray = sheetIO_readTable(plan.table);
  var headers = tableArray[1];

  if (plan.columns === null) {
    // Positional insert: validate value count matches column count per row
    var outputRows = [];
    for (var r = 0; r < plan.rows.length; r++) {
      if (headers.length !== plan.rows[r].length) {
        throw new Error("The number of columns does not match");
      }
      outputRows.push(plan.rows[r]);
    }
    sheetIO_writeRows(plan.table, outputRows);
  } else {
    // Column-mapped insert: validate column count matches value count per row
    var outputRows = [];
    for (var r = 0; r < plan.rows.length; r++) {
      var values = plan.rows[r];
      if (plan.columns.length !== values.length) {
        throw new Error("The number of colums does not match the number of values");
      }

      // Reject duplicate target columns
      var seenColumns = {};
      for (var i = 0; i < plan.columns.length; i++) {
        if (seenColumns.hasOwnProperty(plan.columns[i])) {
          throw new Error("Duplicate column: " + plan.columns[i]);
        }
        seenColumns[plan.columns[i]] = true;
      }

      // Map values to correct column positions
      var row = [];
      for (var c = 0; c < headers.length; c++) {
        row.push("");
      }

      for (var i = 0; i < plan.columns.length; i++) {
        var colIndex = findInArray_(headers, plan.columns[i]);
        if (colIndex === -1) {
          throw new Error("The columns do not match");
        }
        row[colIndex] = values[i];
      }

      outputRows.push(row);
    }
    sheetIO_writeRows(plan.table, outputRows);
  }
}
