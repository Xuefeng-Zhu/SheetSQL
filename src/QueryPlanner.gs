// =========================================================================
// Query Planner — translates parsed ASTs into execution plans.
// Pure functions, no SpreadsheetApp references.
// =========================================================================

/**
 * Extract join key pairs and operators from a SQLParser conditions AST.
 * Handles simple conditions and compound AND/OR trees.
 *
 * @param {object} conditions - join condition AST node
 * @returns {{ keys: Array<Array<string>>, operators: Array<string> }}
 */
function extractJoinKeys(conditions) {
  if (conditions.operation === 'AND' || conditions.operation === 'OR') {
    var leftResult = extractJoinKeys(conditions.left);
    var rightResult = extractJoinKeys(conditions.right);
    return {
      keys: leftResult.keys.concat(rightResult.keys),
      operators: leftResult.operators.concat(rightResult.operators)
    };
  }
  // Simple condition: { operation: "=", left: {values: [...]}, right: {values: [...]} }
  var leftValues = conditions.left.values;
  var rightValues = conditions.right.values;
  var leftCol = leftValues[leftValues.length - 1];
  var rightCol = rightValues[rightValues.length - 1];
  return {
    keys: [[leftCol, rightCol]],
    operators: [conditions.operation]
  };
}

/**
 * Plan a SELECT query from a SQLParser AST.
 * Returns an ordered execution plan.
 *
 * @param {object} ast - SQLParser.parse() output
 * @returns {object} execution plan
 */
function planSelect(ast) {
  // Source table
  var source = ast.source.name.value;

  // Joins
  var joins = [];
  var astJoins = ast.joins || [];
  for (var i = 0; i < astJoins.length; i++) {
    var join = astJoins[i];
    var table2 = join.right.name.value;
    var side = join.side || null;
    var extracted = extractJoinKeys(join.conditions);
    joins.push({
      table: table2,
      keys: extracted.keys,
      operators: extracted.operators,
      side: side
    });
  }

  // WHERE — pass conditions AST directly
  var where = null;
  if (ast.where !== null && ast.where !== undefined) {
    where = ast.where.conditions;
  }

  // GROUP BY
  var groupBy = null;
  if (ast.group !== null && ast.group !== undefined) {
    var groupFields = ast.group.fields;
    var groupColumns = [];
    for (var i = 0; i < groupFields.length; i++) {
      var vals = groupFields[i].values;
      groupColumns.push(vals[vals.length - 1]);
    }
    var having = null;
    if (ast.group.having !== null && ast.group.having !== undefined) {
      having = ast.group.having.conditions;
    }
    groupBy = {
      columns: groupColumns,
      having: having
    };
  }

  // Fields — pass through from AST for projection
  var fields = ast.fields;

  // Distinct
  var distinct = ast.distinct || false;

  // Unions — pass through sub-ASTs
  var unions = ast.unions || [];

  // ORDER BY
  var orderBy = null;
  if (ast.order !== null && ast.order !== undefined) {
    var orderings = ast.order.orderings;
    var orderColumns = [];
    var orderDirections = [];
    for (var i = 0; i < orderings.length; i++) {
      orderColumns.push(orderings[i].value.value);
      orderDirections.push(orderings[i].direction);
    }
    orderBy = {
      columns: orderColumns,
      directions: orderDirections
    };
  }

  // LIMIT
  var limit = null;
  if (ast.limit !== null && ast.limit !== undefined) {
    limit = ast.limit.value.value;
  }

  return {
    source: source,
    joins: joins,
    where: where,
    groupBy: groupBy,
    fields: fields,
    distinct: distinct,
    unions: unions,
    orderBy: orderBy,
    limit: limit
  };
}

/**
 * Plan an UPDATE from a simpleSqlParser AST.
 *
 * @param {object} ast - simpleSqlParser.sql2ast() output
 * @returns {object} execution plan { table, where, setAssignments }
 */
function planUpdate(ast) {
  var table = ast['UPDATE'][0];
  var where = ast['WHERE'] || null;

  var setStrings = ast['SET'];
  var setAssignments = [];
  for (var i = 0; i < setStrings.length; i++) {
    var eqIndex = setStrings[i].indexOf('=');
    var column = setStrings[i].substring(0, eqIndex).trim();
    var rawValue = setStrings[i].substring(eqIndex + 1).trim();
    var value = parseValue(rawValue);
    setAssignments.push({ column: column, value: value });
  }

  return {
    table: table,
    where: where,
    setAssignments: setAssignments
  };
}

/**
 * Plan a DELETE from a simpleSqlParser AST.
 *
 * @param {object} ast - simpleSqlParser.sql2ast() output
 * @returns {object} execution plan { table, where }
 */
function planDelete(ast) {
  var table = ast['DELETE FROM'][0];
  var where = ast['WHERE'] || null;

  return {
    table: table,
    where: where
  };
}

/**
 * Plan an INSERT from a simpleSqlParser AST.
 *
 * @param {object} ast - simpleSqlParser.sql2ast() output
 * @returns {object} execution plan { table, columns, values }
 */
function planInsert(ast) {
  var insertInfo = ast['INSERT INTO'];
  var table = insertInfo.table;
  var columns = insertInfo.columns || null;

  var rawRows = ast['VALUES'];
  var rows = [];
  for (var r = 0; r < rawRows.length; r++) {
    var row = [];
    for (var i = 0; i < rawRows[r].length; i++) {
      row.push(parseValue(rawRows[r][i]));
    }
    rows.push(row);
  }

  return {
    table: table,
    columns: columns,
    rows: rows
  };
}

/**
 * Parse a raw string value from SQL: strip quotes, convert numbers.
 *
 * @param {string} raw - raw value string
 * @returns {string|number} parsed value
 */
function parseValue(raw) {
  if (typeof raw !== 'string') {
    return raw;
  }
  var trimmed = raw.trim();

  // Strip surrounding single or double quotes
  if ((trimmed.charAt(0) === "'" && trimmed.charAt(trimmed.length - 1) === "'") ||
      (trimmed.charAt(0) === '"' && trimmed.charAt(trimmed.length - 1) === '"')) {
    return trimmed.substring(1, trimmed.length - 1);
  }

  // Try to convert to number
  if (trimmed !== '' && !isNaN(Number(trimmed))) {
    return Number(trimmed);
  }

  return trimmed;
}
