var SQL_VALID_COMPARISON_OPERATORS = ['<', '>', '=', '>=', '<='];

function resolveRowsFromWhere_(tableArray, where, rowSelector) {
  if (where == null) {
    return getAllDataRowIndexes_(tableArray);
  }

  if (where.logic == null) {
    return rowSelector(tableArray, where.left, where.operator, where.right);
  }

  return resolveRowsByLogic_(tableArray, where, rowSelector);
}

function resolveRowsByLogic_(tableArray, term, rowSelector) {
  var logic = term.logic;
  var terms = term.terms;
  var leftTerm = terms[0];
  var rightTerm = terms[1];
  var rowsLeft = leftTerm.logic == null ?
      rowSelector(tableArray, leftTerm.left, leftTerm.operator, leftTerm.right) :
      resolveRowsByLogic_(tableArray, leftTerm, rowSelector);
  var rowsRight = rightTerm.logic == null ?
      rowSelector(tableArray, rightTerm.left, rightTerm.operator, rightTerm.right) :
      resolveRowsByLogic_(tableArray, rightTerm, rowSelector);

  if (logic === 'AND') {
    return intersectSortedRows_(rowsLeft, rowsRight);
  }
  if (logic === 'OR') {
    return unionSortedRows_(rowsLeft, rowsRight);
  }

  throw 'Invalid logic operator : ' + logic;
}

function getAllDataRowIndexes_(tableArray) {
  var rows = [];
  for (var rowIndex = 2; rowIndex < tableArray.length; rowIndex++) {
    rows.push(rowIndex);
  }
  return rows;
}

function selectRowsByComparison_(inputRange, attribute, operator, value) {
  var data = inputRange;
  var attributeIndex = findInArray_(data[1], attribute);
  if (attributeIndex === -1) {
    throw 'Invalid attribute : ' + attribute;
  }

  if (!isValidComparisonOperator_(operator)) {
    throw 'Invalid operator : ' + operator;
  }

  var outputRows = [];
  for (var i = 2; i < data.length; i++) {
    if (evaluateComparison_(data[i][attributeIndex], operator, value)) {
      outputRows.push(i);
    }
  }
  return outputRows;
}

function isValidComparisonOperator_(operator) {
  return findInArray_(SQL_VALID_COMPARISON_OPERATORS, operator) !== -1;
}

function evaluateComparison_(leftValue, operator, rightValue) {
  if (operator === '<') {
    return leftValue < rightValue;
  }
  if (operator === '>') {
    return leftValue > rightValue;
  }
  if (operator === '>=') {
    return leftValue >= rightValue;
  }
  if (operator === '<=') {
    return leftValue <= rightValue;
  }
  return leftValue == rightValue;
}

function intersectSortedRows_(rows0, rows1) {
  var i = 0;
  var j = 0;
  var out = [];
  while (i < rows0.length && j < rows1.length) {
    if (rows0[i] < rows1[j]) {
      i++;
    } else if (rows0[i] > rows1[j]) {
      j++;
    } else {
      out.push(rows0[i]);
      i++;
      j++;
    }
  }
  return out;
}

function unionSortedRows_(rows0, rows1) {
  var output = rows0.slice();
  var i = 0;
  var j = 0;
  while (j < rows1.length) {
    if (i >= output.length) {
      output = output.concat(rows1.slice(j));
      break;
    }

    if (output[i] < rows1[j]) {
      i++;
    } else if (output[i] > rows1[j]) {
      output.splice(i, 0, rows1[j]);
      i++;
      j++;
    } else {
      i++;
      j++;
    }
  }
  return output;
}
