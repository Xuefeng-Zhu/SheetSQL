/**
* Find an element in array.
*
* @param {array} array where element need to be searched
* @param {object} element that will be searched in the array.
* @return {number} index of the element, -1 if not found.
*/
function findInArray_(arr, ele) {
  for (var i=0; i < arr.length; i++)
    if (arr[i]===ele)
      return i;
  return -1;
}

// =========================================================================
// Legacy GROUP BY helpers — still used by selectQuery for GROUP BY/HAVING
// =========================================================================

/**
* Project the given attributes from a table.
*
* @param {string or range} name of the sheet or a range.
* @param {array} attributes that need to be projected.
* @return {range} table in form of a 2d array.
*/
function project(inputRange, attributes)
{
  var data =  inputRange;
  var hdr = data[1];
  
  var attribute_idx = [];
  if (typeof attributes == "string")
  {
    idx = findInArray_(hdr, attributes);
    if (idx != -1)
      attribute_idx.push(idx);
    else
      throw new Error("Invalid attribute : " + attributes)
  }
  else {
    for (var i=0; i < attributes.length; i++) {
      if (typeof attributes[i] == "string")
        idx = findInArray_(hdr, attributes[i]);
      else
      {
        var field = attributes[i];
        var temp = projectHelp(data, field);
        hdr = data[1];
        idx = findInArray_(hdr, temp);
      }
      if (idx != -1)
        attribute_idx.push(idx);
      else
        throw new Error("Invalid attribute : " + attributes[i]);
    }
  }
  var out=[];
  
  // Copy the table name
  out.push(data[0]);
  
  // Copy data along with column headers
  for (var i = 1; i < data.length; i++) {
    var outRow = [];
    for (var j = 0; j < attribute_idx.length; j++) {
      outRow.push(data[i][attribute_idx[j]])
    }
    out.push(outRow);
  } 
  return out;
}

function projectHelp(data, field)
{
  if (field["operation"] != null)
  {
    var operation = field["operation"];
    var left = field["left"];
    var right = field["right"];
    var attr;
    if (left["operation"] != null)
      attr = projectHelp(data, left);
    else 
    {
      var values = left["values"];
      attr = values[values.length - 1];
    }
    var value = right["value"]
    return projectNewc(data, attr, operation, value);
  }
  
  if(field["name"] != null) 
  {
    var name = field["name"];
    var arguments = field["arguments"][0]["values"];
    var attr = arguments[arguments.length - 1];
    var hdr = data[1];
    var index = findInArray_(hdr, attr)
    var result = groupFunct(data.slice(2), index, name);
    var newHdr = name+"("+attr+")";
    data.splice(1);
    data.push([newHdr]);
    data.push([result]);
    return newHdr;
  }
}

function projectNewc(data, attr, operation, value)
{
  var newAttr = attr + operation + value;
  var hdr = data[1];
  hdr.push(newAttr);
  data.splice(1, 1, hdr);
  var index = findInArray_(data[1], attr)
  for (var i = 2; i < data.length; i++)
  {
    var row = data[i];
    if (operation == "+")
      row.push(row[index] + value);
    else if (operation == "-")
      row.push(row[index] - value);
    else if (operation == "/")
      row.push(row[index] / value);
    data.splice(i, 1, row);
  }
  return newAttr;
}

/**
* Perform union between two tables.
*
* @param {string or range} name of the sheet or a range for first table.
* @param {string or range} name of the sheet or a range for second table.
* @return {range} table in form of a 2d array.
*/
function union(inputRange1, inputRange2)
{
  // Get data from sheets
  table1 = inputRange1;
  table2 = inputRange2;
  
  /* Validate that column count is same */
  if (table1[1].length != table2[1].length)
    throw new Error("Column counts mismatch");
  
  /* Array to gather the output of the operator */
  var out = [];
  
  /* Copy first table along with headers */
  for (var i=0; i < table1.length; i++) 
    out.push(table1[i]);
  /* Copy only data from second table */
  for (var i=2; i < table2.length; i++) 
    out.push(table2[i]);
  
  return out;
}

function groupM(input, attributes)
{
  var data =  input;
  var hdr = data[1];
  
  //store all attributes 
  var attribute_idx = [];
  for (var i = 0; i < attributes.length; i++)
  {
    attribute_idx.push(findInArray_(hdr, attributes[i]));
    if (attribute_idx[i] == -1)
      throw new Error("Invalid attribute : " + attributes[i]);
  }
  var out = [];
  out.push(data[0]);
  out.push(data[1]);
  
  var hash = new Object();
  var temp = data.slice(2);
  for (var i = 0; i < attribute_idx.length; i++)
  {
    groupHelp(temp, hash, i, attribute_idx[i]); 
  }
  
  out.push(hash);
  return out;
}

function groupHelp(data, hash, count, attr_index)
{
  if (count == 0)
  {
      for(var i = 0; i < data.length; i++)
    {
      if (hash[data[i][attr_index]] == null)
        hash[data[i][attr_index]] = new Array(data[i]);
      else 
        hash[data[i][attr_index]].push(data[i]);
    }
  }
  else
  {
    for (var i in hash)
    {
      var temp = hash[i];
      hash[i] = new Object();
      groupHelp(temp, hash[i], count-1, attr_index);
    }
  }
}

function groupHaving(input, attrs, aggfuncts, operations, values, deep)
{
  var data =  input;
  var hdr = data[1];
  
  //store all attributes 
  var attribute_idx = [];
  for (var i = 0; i < attrs.length; i++)
  {
    attribute_idx.push(findInArray_(hdr, attrs[i]));
    if (attribute_idx[i] == -1)
      throw new Error("Invalid attribute : " + attrs[i]);
  }
  
  for (var i = 0; i < attrs.length; i++)
  {
    groupHavingHelp(data[2], attribute_idx[i], aggfuncts[i], operations[i], values[i], deep);
  }
  return data;
}

function groupHavingHelp(hash, attr, aggfunct, operator, value, deep)
{
  if (deep == 1)
  {
    for (var i in hash)
    {
      var result = groupFunct(hash[i], attr, aggfunct);
      if (operator=="<")
      {
        if (result >= value)
          delete hash[i];
      }
      else if (operator==">")
      {
        if (result <= value)
          delete hash[i];
      }
      else if (operator==">=")
      {
        if (result < value)
          delete hash[i];
      }
      else if (operator=="<=")
      {
        if (result > value)
          delete hash[i];
      }
      else
      {
        if (result != value)
          delete hash[i];
      }
    }
  }
  else 
  {
    for (var i in hash)
    {
      groupHavingHelp(hash[i], attr, aggfunct, operation, value, deep - 1);
    }
  }
}

function groupProject(hash, attrs, deep)
{
  var result = [];
  result.push(hash[0]);
  var hd = [];
  for (var i = 0; i < attrs.length; i++)
  {
    if (typeof attrs[i] == "string")
      hd.push(attrs[i]);
    else
    {
      var field = attrs[i];
      var name = field["name"];
      var arguments = field["arguments"][0]["values"];
      var value = arguments[arguments.length - 1];
      hd.push(name + "(" + value +")");
    } 
  }
  result.push(hd);
  groupProjectHelp(hash[2], hash[1],attrs, deep, result);
  return result;
}

function groupProjectHelp(hash, hdr, attrs, deep, result)
{
  if (deep == 1)
  {
    for (var i in hash)
    {
      var row = [];
      var data = hash[i];
      for (var k = 0; k < attrs.length; k++)
      {
        if (typeof attrs[k] == "string")
        {
          var index = findInArray_(hdr, attrs[k]);
          row.push(data[0][index]);
        }
        else
        {
          var field = attrs[k];
          var name = field["name"];
          var arguments = field["arguments"][0]["values"];
          var value = arguments[arguments.length - 1];
          var index = findInArray_(hdr, value);
          row.push(groupFunct(data, index, name));
        } 
      }
      result.push(row);
    }
  }
  else 
  {
    for (var i in hash)
      groupProject(hash, hdr, attrs, deep, result);
  }
}

function groupFunct(data, attr_index, aggfunct)
{
  if (aggfunct == 'MIN')
  {
    var min = Number.MAX_VALUE; 
    for (var i = 0; i < data.length; i++)
    {
      if (data[i][attr_index] < min)
        min = data[i][attr_index];
    }
    return min;
  }
  //find max
  else if (aggfunct == "MAX")
  {
    var max = Number.MIN_VALUE;
    for (var i = 0; i < data.length; i++)
    {
      if (data[i][attr_index] > max)
        max = data[i][attr_index];
    }
    return max;
  }
  //find count 
  else if (aggfunct == "COUNT")
  {
    return data.length;
  }
  //find sum
  else if (aggfunct == "SUM")
  {
    var sum = 0;
    for (var i = 0; i < data.length; i++)
    {
      sum += data[i][attr_index];
    }    
    return sum;
  }
  else if (aggfunct == "AVG")
  {
    var sum = 0;
    for (var i = 0; i < data.length; i++)
    {
      sum += data[i][attr_index];
    }    
    return sum / data.length;
  }
}

// =========================================================================
// RA_Core — Pure relational algebra functions (new implementation)
// =========================================================================

/**
 * SQL LIKE pattern matching.
 * % matches zero or more characters, _ matches exactly one character.
 * Case-sensitive. Anchored for exact match.
 *
 * @param {string} value - the string to test
 * @param {string} pattern - SQL LIKE pattern
 * @returns {boolean}
 */
function raLike(value, pattern) {
  // Escape special regex characters except % and _
  var escaped = String(pattern).replace(/([.+?^${}()|[\]\\*])/g, '\\$1');
  // Replace SQL wildcards with regex equivalents
  escaped = escaped.replace(/%/g, '.*');
  escaped = escaped.replace(/_/g, '.');
  var regex = new RegExp('^' + escaped + '$');
  return regex.test(String(value));
}

/**
 * Filter rows matching a condition and return matching row indices.
 * Indices are into the tableArray, starting from 2 (first data row).
 *
 * @param {Array<Array>} tableArray - Table_Array format
 * @param {string} attribute - column name
 * @param {string} operator - one of <, >, =, >=, <=, LIKE, IN, IS, IS NOT
 * @param {*} value - comparison value (array for IN, or object with values for column ref)
 * @returns {Array<number>} matching row indices
 */
function raSelectIndices(tableArray, attribute, operator, value) {
  var headers = tableArray[1];
  var attributeIndex = findInArray_(headers, attribute);
  if (attributeIndex === -1) {
    throw new Error("Invalid attribute : " + attribute);
  }

  // Check if value is a column reference (has values array property)
  var isColumnRef = value !== null && value !== undefined &&
    typeof value === 'object' && !Array.isArray(value) && Array.isArray(value.values);
  var rightColIndex = -1;
  if (isColumnRef) {
    var rightColName = value.values[value.values.length - 1];
    rightColIndex = findInArray_(headers, rightColName);
    if (rightColIndex === -1) {
      throw new Error("Invalid attribute : " + rightColName);
    }
  }

  // Validate operator
  var validOps = ['<', '>', '=', '>=', '<=', 'LIKE', 'IN', 'IS', 'IS NOT'];
  if (findInArray_(validOps, operator) === -1) {
    throw new Error("Invalid operator : " + operator);
  }

  var out = [];
  for (var i = 2; i < tableArray.length; i++) {
    var cellValue = tableArray[i][attributeIndex];
    var compareValue = isColumnRef ? tableArray[i][rightColIndex] : value;
    var match = false;

    if (operator === '<') {
      match = cellValue < compareValue;
    } else if (operator === '>') {
      match = cellValue > compareValue;
    } else if (operator === '>=') {
      match = cellValue >= compareValue;
    } else if (operator === '<=') {
      match = cellValue <= compareValue;
    } else if (operator === '=') {
      match = cellValue === compareValue;
    } else if (operator === 'LIKE') {
      match = raLike(cellValue, compareValue);
    } else if (operator === 'IN') {
      if (Array.isArray(compareValue)) {
        for (var j = 0; j < compareValue.length; j++) {
          if (cellValue === compareValue[j]) {
            match = true;
            break;
          }
        }
      }
    } else if (operator === 'IS') {
      match = cellValue === "" || cellValue === " " || cellValue === null || cellValue === undefined;
    } else if (operator === 'IS NOT') {
      match = !(cellValue === "" || cellValue === " " || cellValue === null || cellValue === undefined);
    }

    if (match) {
      out.push(i);
    }
  }
  return out;
}

/**
 * Filter rows matching a condition, returns a new Table_Array.
 *
 * @param {Array<Array>} tableArray - Table_Array format
 * @param {string} attribute - column name
 * @param {string} operator - one of <, >, =, >=, <=, LIKE, IN, IS, IS NOT
 * @param {*} value - comparison value (array for IN)
 * @returns {Array<Array>} filtered Table_Array
 */
function raSelect(tableArray, attribute, operator, value) {
  var indices = raSelectIndices(tableArray, attribute, operator, value);
  var out = [];
  out.push(tableArray[0]);
  out.push(tableArray[1]);
  for (var i = 0; i < indices.length; i++) {
    out.push(tableArray[indices[i]]);
  }
  return out;
}

/**
 * Extract specified columns from a Table_Array.
 * Supports string column names and expression objects (arithmetic and aggregate).
 *
 * @param {Array<Array>} tableArray
 * @param {Array<string|object>} attributes - column names or expression objects
 * @returns {Array<Array>} projected Table_Array
 */
function raProject(tableArray, attributes) {
  var data = tableArray;
  var hdr = data[1].slice();

  // We may need to mutate data for expressions, so work on a copy
  var workData = [];
  for (var r = 0; r < data.length; r++) {
    workData.push(data[r].slice());
  }

  var attributeIndices = [];

  if (typeof attributes === "string") {
    var idx = findInArray_(hdr, attributes);
    if (idx === -1) {
      throw new Error("Invalid attribute : " + attributes);
    }
    attributeIndices.push(idx);
  } else {
    for (var i = 0; i < attributes.length; i++) {
      var attr = attributes[i];
      if (typeof attr === "string") {
        var idx = findInArray_(hdr, attr);
        if (idx === -1) {
          throw new Error("Invalid attribute : " + attr);
        }
        attributeIndices.push(idx);
      } else {
        // Expression object: arithmetic or aggregate
        var newColName = raProjectExpression_(workData, hdr, attr);
        var idx = findInArray_(hdr, newColName);
        if (idx === -1) {
          throw new Error("Invalid attribute : " + attr);
        }
        attributeIndices.push(idx);
      }
    }
  }

  var out = [];
  out.push(workData[0]);

  // Build projected rows (headers + data)
  for (var i = 1; i < workData.length; i++) {
    var outRow = [];
    for (var j = 0; j < attributeIndices.length; j++) {
      outRow.push(workData[i][attributeIndices[j]]);
    }
    out.push(outRow);
  }
  return out;
}

/**
 * Handle expression objects in projection (arithmetic ops and aggregates).
 * Mutates workData and hdr in place, returns the new column name.
 * @private
 */
function raProjectExpression_(workData, hdr, field) {
  if (field.operation != null) {
    // Arithmetic expression: {operation, left, right}
    var operation = field.operation;
    var left = field.left;
    var right = field.right;
    var attr;
    if (left.operation != null) {
      attr = raProjectExpression_(workData, hdr, left);
    } else {
      var values = left.values;
      attr = values[values.length - 1];
    }
    var value = right.value;
    return raProjectNewColumn_(workData, hdr, attr, operation, value);
  }

  if (field.name != null) {
    // Aggregate function: {name, arguments}
    var name = field.name;
    var args = field.arguments[0].values;
    var attr = args[args.length - 1];
    var index = findInArray_(hdr, attr);
    var result = raAggregate(workData.slice(2), index, name);
    var newHdr = name + "(" + attr + ")";
    // Replace data with single aggregate row
    workData.splice(1);
    workData.push([newHdr]);
    workData.push([result]);
    hdr.length = 0;
    hdr.push(newHdr);
    return newHdr;
  }
}

/**
 * Add a computed arithmetic column to workData.
 * @private
 */
function raProjectNewColumn_(workData, hdr, attr, operation, value) {
  var newAttr = attr + operation + value;
  var index = findInArray_(hdr, attr);
  hdr.push(newAttr);
  workData[1] = hdr.slice();
  for (var i = 2; i < workData.length; i++) {
    var row = workData[i];
    if (operation === "+") {
      row.push(row[index] + value);
    } else if (operation === "-") {
      row.push(row[index] - value);
    } else if (operation === "/") {
      row.push(row[index] / value);
    }
  }
  return newAttr;
}

/**
 * Join two Table_Arrays.
 *
 * @param {Array<Array>} left - left Table_Array
 * @param {Array<Array>} right - right Table_Array
 * @param {Array<Array<string>>|null} keys - [[leftCol, rightCol], ...] or null for cartesian
 * @param {Array<string>} operators - comparison operators per key pair (default "=")
 * @param {string} joinType - "inner", "left", or "right"
 * @returns {Array<Array>} joined Table_Array
 */
function raJoin(left, right, keys, operators, joinType) {
  var out = [];
  var newTableName = left[0][0] + "_" + right[0][0];
  out.push([newTableName]);
  out.push(left[1].concat(right[1]));

  var leftKeyIndices = [];
  var rightKeyIndices = [];

  if (keys !== null && keys !== undefined) {
    for (var i = 0; i < keys.length; i++) {
      var li = findInArray_(left[1], keys[i][0]);
      var ri = findInArray_(right[1], keys[i][1]);
      if (li === -1) {
        throw new Error("Invalid attribute : " + keys[i][0]);
      }
      if (ri === -1) {
        throw new Error("Invalid attribute : " + keys[i][1]);
      }
      leftKeyIndices.push(li);
      rightKeyIndices.push(ri);
    }
  }

  var rightColCount = right[1].length;
  var nullRightRow = [];
  for (var c = 0; c < rightColCount; c++) {
    nullRightRow.push(null);
  }

  var leftColCount = left[1].length;
  var nullLeftRow = [];
  for (var c = 0; c < leftColCount; c++) {
    nullLeftRow.push(null);
  }

  // Cartesian product when keys is null
  if (keys === null || keys === undefined) {
    for (var i = 2; i < left.length; i++) {
      for (var j = 2; j < right.length; j++) {
        out.push(left[i].concat(right[j]));
      }
    }
    return out;
  }

  if (joinType === "right") {
    // For right join: all right rows, nulls for unmatched left
    var rightMatched = [];
    for (var j = 2; j < right.length; j++) {
      rightMatched.push(false);
    }

    for (var j = 2; j < right.length; j++) {
      var hasMatch = false;
      for (var i = 2; i < left.length; i++) {
        var found = true;
        for (var k = 0; k < leftKeyIndices.length; k++) {
          var op = (operators && operators[k]) ? operators[k] : "=";
          if (!raCompareValues_(left[i][leftKeyIndices[k]], right[j][rightKeyIndices[k]], op)) {
            found = false;
            break;
          }
        }
        if (found) {
          out.push(left[i].concat(right[j]));
          hasMatch = true;
        }
      }
      if (!hasMatch) {
        out.push(nullLeftRow.concat(right[j]));
      }
    }
    return out;
  }

  // Inner or left join
  for (var i = 2; i < left.length; i++) {
    var hasMatch = false;
    for (var j = 2; j < right.length; j++) {
      var found = true;
      for (var k = 0; k < leftKeyIndices.length; k++) {
        var op = (operators && operators[k]) ? operators[k] : "=";
        if (!raCompareValues_(left[i][leftKeyIndices[k]], right[j][rightKeyIndices[k]], op)) {
          found = false;
          break;
        }
      }
      if (found) {
        out.push(left[i].concat(right[j]));
        hasMatch = true;
      }
    }
    if (joinType === "left" && !hasMatch) {
      out.push(left[i].concat(nullRightRow));
    }
  }
  return out;
}

/**
 * Compare two values using the given operator with strict equality for "=".
 * @private
 */
function raCompareValues_(a, b, operator) {
  if (operator === '=') return a === b;
  if (operator === '<') return a < b;
  if (operator === '>') return a > b;
  if (operator === '>=') return a >= b;
  if (operator === '<=') return a <= b;
  return a === b;
}

/**
 * Combine two Table_Arrays (all rows from both).
 *
 * @param {Array<Array>} table1
 * @param {Array<Array>} table2
 * @returns {Array<Array>} combined Table_Array
 * @throws {Error} if column counts don't match
 */
function raUnion(table1, table2) {
  if (table1[1].length !== table2[1].length) {
    throw new Error("Column counts mismatch");
  }
  var out = [];
  for (var i = 0; i < table1.length; i++) {
    out.push(table1[i]);
  }
  for (var i = 2; i < table2.length; i++) {
    out.push(table2[i]);
  }
  return out;
}

/**
 * Rows present in both Table_Arrays using strict equality.
 *
 * @param {Array<Array>} table1
 * @param {Array<Array>} table2
 * @returns {Array<Array>} intersection Table_Array
 */
function raIntersection(table1, table2) {
  if (table1[1].length !== table2[1].length) {
    throw new Error("Column counts mismatch");
  }
  var out = [];
  out.push(table1[0]);
  out.push(table1[1]);

  for (var i = 2; i < table1.length; i++) {
    for (var j = 2; j < table2.length; j++) {
      var found = true;
      for (var k = 0; k < table1[1].length; k++) {
        if (table1[i][k] !== table2[j][k]) {
          found = false;
          break;
        }
      }
      if (found) {
        out.push(table1[i]);
        break;
      }
    }
  }
  return out;
}

/**
 * Rows in table1 not in table2 using strict equality.
 *
 * @param {Array<Array>} table1
 * @param {Array<Array>} table2
 * @returns {Array<Array>} difference Table_Array
 */
function raDifference(table1, table2) {
  if (table1[1].length !== table2[1].length) {
    throw new Error("Column counts mismatch");
  }
  var out = [];
  out.push(table1[0]);
  out.push(table1[1]);

  for (var i = 2; i < table1.length; i++) {
    var inTable2 = false;
    for (var j = 2; j < table2.length; j++) {
      var found = true;
      for (var k = 0; k < table1[1].length; k++) {
        if (table1[i][k] !== table2[j][k]) {
          found = false;
          break;
        }
      }
      if (found) {
        inTable2 = true;
        break;
      }
    }
    if (!inTable2) {
      out.push(table1[i]);
    }
  }
  return out;
}

/**
 * Stable sort by multiple columns.
 * Returns a new Table_Array (does not mutate input).
 *
 * @param {Array<Array>} tableArray
 * @param {Array<string>} columns - column names
 * @param {Array<string>} directions - "ASC" or "DESC" per column
 * @returns {Array<Array>} sorted Table_Array
 */
function raSort(tableArray, columns, directions) {
  var hdr = tableArray[1];
  var colIndices = [];
  for (var i = 0; i < columns.length; i++) {
    var idx = findInArray_(hdr, columns[i]);
    if (idx === -1) {
      throw new Error("Invalid attribute : " + columns[i]);
    }
    colIndices.push(idx);
  }

  // Copy data rows with original indices for stable sort
  var dataRows = [];
  for (var i = 2; i < tableArray.length; i++) {
    dataRows.push({ index: i - 2, row: tableArray[i].slice() });
  }

  dataRows.sort(function(a, b) {
    for (var k = 0; k < colIndices.length; k++) {
      var ci = colIndices[k];
      var dir = directions[k] === "DESC" ? -1 : 1;
      var va = a.row[ci];
      var vb = b.row[ci];
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
    }
    // Stable: preserve original order for equal elements
    return a.index - b.index;
  });

  var out = [];
  out.push(tableArray[0]);
  out.push(tableArray[1]);
  for (var i = 0; i < dataRows.length; i++) {
    out.push(dataRows[i].row);
  }
  return out;
}

/**
 * Remove duplicate rows using JSON.stringify for comparison.
 *
 * @param {Array<Array>} tableArray
 * @returns {Array<Array>} deduplicated Table_Array
 */
function raDistinct(tableArray) {
  var out = [];
  out.push(tableArray[0]);
  out.push(tableArray[1]);
  var seen = {};
  for (var i = 2; i < tableArray.length; i++) {
    var key = JSON.stringify(tableArray[i]);
    if (!seen.hasOwnProperty(key)) {
      seen[key] = true;
      out.push(tableArray[i]);
    }
  }
  return out;
}

/**
 * Keep first row for each unique value in the specified column.
 *
 * @param {Array<Array>} tableArray
 * @param {string} column - column name
 * @returns {Array<Array>} deduplicated Table_Array
 */
function raDistinctOn(tableArray, column) {
  var hdr = tableArray[1];
  var colIndex = findInArray_(hdr, column);
  if (colIndex === -1) {
    throw new Error("Invalid attribute : " + column);
  }
  var out = [];
  out.push(tableArray[0]);
  out.push(tableArray[1]);
  var seen = {};
  for (var i = 2; i < tableArray.length; i++) {
    var val = tableArray[i][colIndex];
    var key = JSON.stringify(val);
    if (!seen.hasOwnProperty(key)) {
      seen[key] = true;
      out.push(tableArray[i]);
    }
  }
  return out;
}

/**
 * Compute aggregate value for a column in data rows.
 *
 * @param {Array<Array>} data - data rows only (no headers)
 * @param {number} columnIndex
 * @param {string} func - SUM, COUNT, MIN, MAX, AVG
 * @returns {number}
 */
function raAggregate(data, columnIndex, func) {
  if (func === "COUNT") {
    return data.length;
  }
  if (func === "SUM") {
    var sum = 0;
    for (var i = 0; i < data.length; i++) {
      sum += data[i][columnIndex];
    }
    return sum;
  }
  if (func === "MIN") {
    var min = data[0][columnIndex];
    for (var i = 1; i < data.length; i++) {
      if (data[i][columnIndex] < min) {
        min = data[i][columnIndex];
      }
    }
    return min;
  }
  if (func === "MAX") {
    var max = data[0][columnIndex];
    for (var i = 1; i < data.length; i++) {
      if (data[i][columnIndex] > max) {
        max = data[i][columnIndex];
      }
    }
    return max;
  }
  if (func === "AVG") {
    var sum = 0;
    for (var i = 0; i < data.length; i++) {
      sum += data[i][columnIndex];
    }
    return sum / data.length;
  }
  return 0;
}

/**
 * Group rows by columns and apply aggregate functions.
 *
 * @param {Array<Array>} tableArray
 * @param {Array<string>} groupColumns - column names to group by
 * @param {Array<{func: string, column: string}>} aggregates - e.g., [{func: "SUM", column: "salary"}]
 * @returns {Array<Array>} grouped Table_Array with aggregate columns
 */
function raGroupBy(tableArray, groupColumns, aggregates) {
  var hdr = tableArray[1];

  // Resolve group column indices
  var groupIndices = [];
  for (var i = 0; i < groupColumns.length; i++) {
    var idx = findInArray_(hdr, groupColumns[i]);
    if (idx === -1) {
      throw new Error("Invalid attribute : " + groupColumns[i]);
    }
    groupIndices.push(idx);
  }

  // Resolve aggregate column indices
  var aggIndices = [];
  for (var i = 0; i < aggregates.length; i++) {
    var idx = findInArray_(hdr, aggregates[i].column);
    if (idx === -1) {
      throw new Error("Invalid attribute : " + aggregates[i].column);
    }
    aggIndices.push(idx);
  }

  // Build groups using a key based on group column values
  var groupMap = {};
  var groupOrder = [];
  for (var i = 2; i < tableArray.length; i++) {
    var keyParts = [];
    for (var g = 0; g < groupIndices.length; g++) {
      keyParts.push(JSON.stringify(tableArray[i][groupIndices[g]]));
    }
    var key = keyParts.join('|');
    if (!groupMap.hasOwnProperty(key)) {
      groupMap[key] = [];
      groupOrder.push(key);
    }
    groupMap[key].push(tableArray[i]);
  }

  // Build output headers
  var outHeaders = [];
  for (var i = 0; i < groupColumns.length; i++) {
    outHeaders.push(groupColumns[i]);
  }
  for (var i = 0; i < aggregates.length; i++) {
    outHeaders.push(aggregates[i].func + "(" + aggregates[i].column + ")");
  }

  var out = [];
  out.push(tableArray[0]);
  out.push(outHeaders);

  // Compute aggregates for each group
  for (var g = 0; g < groupOrder.length; g++) {
    var groupRows = groupMap[groupOrder[g]];
    var outRow = [];
    // Group column values (from first row in group)
    for (var i = 0; i < groupIndices.length; i++) {
      outRow.push(groupRows[0][groupIndices[i]]);
    }
    // Aggregate values
    for (var i = 0; i < aggregates.length; i++) {
      outRow.push(raAggregate(groupRows, aggIndices[i], aggregates[i].func));
    }
    out.push(outRow);
  }
  return out;
}

/**
 * Intersect two sorted arrays of row indices.
 *
 * @param {Array<number>} rows0
 * @param {Array<number>} rows1
 * @returns {Array<number>}
 */
function raIntersectRows(rows0, rows1) {
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

/**
 * Union two sorted arrays of row indices.
 *
 * @param {Array<number>} rows0
 * @param {Array<number>} rows1
 * @returns {Array<number>}
 */
function raUnionRows(rows0, rows1) {
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

/**
 * Evaluate compound WHERE conditions (AND/OR trees from SQLParser AST).
 * Returns array of matching row indices.
 *
 * Conditions AST structure:
 * - Simple: {operation: "=", left: {values: ["col"]}, right: {value: 5}}
 * - Compound: {operation: "AND"/"OR", left: {condition}, right: {condition}}
 * - IN with literals: right is {value: [{value: v1}, ...]}
 * - IN with subquery: right is {select: subquery}
 * - Column-to-column: right has values array instead of value
 *
 * @param {Array<Array>} tableArray
 * @param {object} conditions - AST condition tree
 * @returns {Array<number>} matching row indices
 */
function raResolveWhere(tableArray, conditions) {
  var operation = conditions.operation;

  // Compound condition (AND / OR)
  if (operation === "AND" || operation === "OR") {
    var leftRows = raResolveWhere(tableArray, conditions.left);
    var rightRows = raResolveWhere(tableArray, conditions.right);
    if (operation === "AND") {
      return raIntersectRows(leftRows, rightRows);
    }
    return raUnionRows(leftRows, rightRows);
  }

  // Simple condition — extract attribute, operator, value
  var operator = operation;
  var leftValues = conditions.left.values;
  var attribute = leftValues[leftValues.length - 1];

  // Determine the comparison value
  var value;
  if (conditions.right.values != null) {
    // Column-to-column comparison: pass as column reference object
    value = conditions.right;
  } else if (operator === "IN") {
    // IN operator: value could be literal list or subquery
    if (conditions.right.value != null) {
      // Literal list: [{value: v1}, {value: v2}, ...]
      var literals = conditions.right.value;
      value = [];
      for (var i = 0; i < literals.length; i++) {
        value.push(literals[i].value);
      }
    } else if (conditions.right.select != null) {
      // Subquery — this will be handled by the executor layer
      // For now, pass through the raw right side
      value = conditions.right;
    } else {
      value = [];
    }
  } else {
    value = conditions.right.value;
  }

  return raSelectIndices(tableArray, attribute, operator, value);
}
