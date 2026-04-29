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
    // Positional insert: validate value count matches column count
    if (headers.length !== plan.values.length) {
      throw new Error("The number of columns does not match");
    }
    sheetIO_writeRows(plan.table, [plan.values]);
  } else {
    // Column-mapped insert: validate column count matches value count
    if (plan.columns.length !== plan.values.length) {
      throw new Error("The number of colums does not match the number of values");
    }

    // Map values to correct column positions
    var row = [];
    for (var c = 0; c < headers.length; c++) {
      row.push("");
    }

    var mappedCount = 0;
    for (var i = 0; i < plan.columns.length; i++) {
      var colIndex = findInArray_(headers, plan.columns[i]);
      if (colIndex === -1) {
        throw new Error("The columns do not match");
      }
      row[colIndex] = plan.values[i];
      mappedCount++;
    }

    if (mappedCount !== plan.columns.length) {
      throw new Error("The columns do not match");
    }

    sheetIO_writeRows(plan.table, [row]);
  }
}
