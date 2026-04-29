/**
 * Execute an UPDATE statement.
 *
 * Parses with simpleSqlParser, plans with planUpdate, finds matching rows
 * using Where.gs functions, and delegates cell updates to Sheet_IO.
 *
 * @param {string} input - SQL UPDATE statement
 */
function update(input) {
  var ast = simpleSqlParser.sql2ast(input);
  var plan = planUpdate(ast);

  // Read the table
  var tableArray = sheetIO_readTable(plan.table);
  var headers = tableArray[1];

  // Get matching row indices using Where.gs (handles simpleSqlParser WHERE format)
  // Need to normalize WHERE values (strip quotes, convert numbers) for comparison
  var normalizedWhere = normalizeSimpleWhere_(plan.where);
  var rows = resolveRowsFromWhere_(tableArray, normalizedWhere, selectRowsByComparison_);

  // Build updates array for sheetIO_updateCells
  // rows are indices into tableArray (starting from 2 for data rows)
  // tableArray: row 0 = [tableName], row 1 = headers, row 2+ = data
  // In the sheet: row 1 = headers, row 2+ = data
  // tableArray index i corresponds to sheet row i
  var updates = [];
  for (var i = 0; i < plan.setAssignments.length; i++) {
    var assignment = plan.setAssignments[i];
    var colIndex = findInArray_(headers, assignment.column);
    if (colIndex === -1) {
      throw new Error("Invalid attribute : " + assignment.column);
    }
    for (var j = 0; j < rows.length; j++) {
      updates.push({
        row: rows[j],
        col: colIndex + 1, // 1-based column for sheet
        value: assignment.value
      });
    }
  }

  sheetIO_updateCells(plan.table, updates);
}

/**
 * Normalize a simpleSqlParser WHERE condition tree by stripping quotes
 * from string values and converting numeric strings to numbers.
 *
 * @param {object|null} where - simpleSqlParser WHERE condition
 * @returns {object|null} normalized condition
 */
function normalizeSimpleWhere_(where) {
  if (where === null || where === undefined) {
    return null;
  }

  // Compound condition with logic (AND/OR)
  if (where.logic != null) {
    var normalizedTerms = [];
    for (var i = 0; i < where.terms.length; i++) {
      normalizedTerms.push(normalizeSimpleWhere_(where.terms[i]));
    }
    return {
      logic: where.logic,
      terms: normalizedTerms
    };
  }

  // Simple condition: {operator, left, right}
  return {
    left: where.left,
    operator: where.operator,
    right: parseValue(where.right)
  };
}
