/**
 * Execute a SELECT query.
 *
 * Parses the input (if string) with SQLParser, plans with planSelect,
 * then executes the plan step-by-step using RA_Core and Sheet_IO.
 *
 * @param {string|object} input - SQL string or pre-parsed AST
 * @returns {Array<Array>} result rows: [headers, ...dataRows] (no table name row)
 */
function selectQuery(input) {
  var ast;
  if (typeof input === "string") {
    ast = SQLParser.parse(input);
  } else {
    ast = input;
  }

  var plan = planSelect(ast);

  // 1. Read source table
  var out;
  if (plan.source === "RANGE") {
    out = sheetIO_readRange();
  } else {
    out = sheetIO_readTable(plan.source);
  }

  // 2. Execute joins
  for (var i = 0; i < plan.joins.length; i++) {
    var joinPlan = plan.joins[i];
    var rightTable = sheetIO_readTable(joinPlan.table);
    var joinType = joinPlan.side ? joinPlan.side.toLowerCase() : "inner";
    out = raJoin(out, rightTable, joinPlan.keys, joinPlan.operators, joinType);
  }

  // 3. Apply WHERE
  if (plan.where !== null) {
    // Pre-process IN subqueries before calling raResolveWhere
    var resolvedWhere = resolveInSubqueries_(plan.where);
    var matchingIndices = raResolveWhere(out, resolvedWhere);
    var filtered = [];
    filtered.push(out[0]);
    filtered.push(out[1]);
    for (var i = 0; i < matchingIndices.length; i++) {
      filtered.push(out[matchingIndices[i]]);
    }
    out = filtered;
  }

  // 4. Apply GROUP BY
  var gFields = null;
  if (plan.groupBy !== null) {
    gFields = plan.groupBy.columns;
    out = groupM(out, gFields);

    // 5. Apply HAVING
    if (plan.groupBy.having !== null) {
      var hConditions = plan.groupBy.having;
      if (hConditions.operation !== "AND") {
        var hLeft = hConditions.left;
        var aggfunct = [hLeft.name];
        var hArguments = hLeft.arguments[0].values;
        var hAttr = [hArguments[hArguments.length - 1]];
        var hOperation = [hConditions.operation];
        var hValue = [hConditions.right.value];
        out = groupHaving(out, hAttr, aggfunct, hOperation, hValue, gFields.length);
      } else {
        var temp = havingHelp(hConditions);
        out = groupHaving(out, temp[2], temp[1], temp[0], temp[3], gFields.length);
      }
    }
  }

  // 6. Apply projection and DISTINCT
  var fields = plan.fields;
  var star = fields[0].star;
  var distinct = plan.distinct;
  var attrs = [];
  var names = [];

  if (!star) {
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].field.value != null) {
        attrs.push(fields[i].field.value);
      } else {
        attrs.push(fields[i].field);
      }
      names.push(fields[i].name);
    }
  }

  if (star) {
    if (distinct) {
      out = raDistinct(out);
    }
  } else {
    if (plan.groupBy === null) {
      out = project(out, attrs);
    } else {
      out = groupProject(out, attrs, gFields.length);
    }
    if (distinct) {
      out = raDistinctOn(out, attrs[0]);
    }
    // Apply column aliases
    for (var i = 0; i < names.length; i++) {
      if (names[i] != null) {
        out[1][i] = names[i].value;
      }
    }
  }

  // 7. Apply UNION
  for (var i = 0; i < plan.unions.length; i++) {
    var subQuery = selectQuery(plan.unions[i].query);
    // subQuery returns [headers, ...data], but union/raUnion expects Table_Array
    // We need to add a table name row for compatibility
    var subTable = [out[0]].concat(subQuery);
    out = union(out, subTable);
    if (!plan.unions[0].all) {
      out = raDistinct(out);
    }
  }

  // 8. Apply ORDER BY
  if (plan.orderBy !== null) {
    out = raSort(out, plan.orderBy.columns, plan.orderBy.directions);
  }

  // 9. Apply LIMIT
  if (plan.limit !== null) {
    // out has [tableName, headers, ...data], limit applies to data rows
    out = out.slice(0, plan.limit + 2);
  }

  // Return without the table name row (row 0) — just [headers, ...dataRows]
  return out.slice(1);
}

/**
 * Recursively walk a WHERE condition tree and resolve IN subqueries
 * by executing them and replacing with literal value arrays.
 *
 * @param {object} conditions - AST condition tree
 * @returns {object} resolved condition tree
 */
function resolveInSubqueries_(conditions) {
  if (conditions === null || conditions === undefined) {
    return conditions;
  }

  var operation = conditions.operation;

  // Compound condition (AND / OR)
  if (operation === "AND" || operation === "OR") {
    return {
      operation: operation,
      left: resolveInSubqueries_(conditions.left),
      right: resolveInSubqueries_(conditions.right)
    };
  }

  // Simple condition — check for IN with subquery
  if (operation === "IN" && conditions.right && conditions.right.select != null) {
    var subResult = selectQuery(conditions.right.select);
    // subResult is [headers, ...dataRows], extract first column values
    var valueList = [];
    for (var i = 1; i < subResult.length; i++) {
      valueList.push({ value: subResult[i][0] });
    }
    return {
      operation: operation,
      left: conditions.left,
      right: { value: valueList }
    };
  }

  // No transformation needed
  return conditions;
}

/**
 * Extract compound HAVING conditions into parallel arrays.
 * Used by groupHaving for multi-condition HAVING clauses.
 *
 * @param {object} conditions - HAVING condition AST
 * @returns {Array} [operations, aggfuncts, attrs, values]
 */
function havingHelp(conditions) {
  var operation = conditions.operation;
  var left = conditions.left;
  var right = conditions.right;
  var out0, out1;

  if (left.operation !== "AND") {
    var operator = [left.operation];
    var left2 = left.left;
    var aggfunct = [left2.name];
    var args = left2.arguments[0].values;
    var attr = [args[args.length - 1]];
    var value = [left.right.value];
    out0 = [operator, aggfunct, attr, value];
  } else {
    out0 = havingHelp(left);
  }

  if (right.operation !== "AND") {
    var operator = [right.operation];
    var left2 = right.left;
    var aggfunct = [left2.name];
    var args = left2.arguments[0].values;
    var attr = [args[args.length - 1]];
    var value = [right.right.value];
    out1 = [operator, aggfunct, attr, value];
  } else {
    out1 = havingHelp(right);
  }

  return [
    out0[0].concat(out1[0]),
    out0[1].concat(out1[1]),
    out0[2].concat(out1[2]),
    out0[3].concat(out1[3])
  ];
}
