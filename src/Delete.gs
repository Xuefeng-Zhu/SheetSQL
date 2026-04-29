function deleteFrom(input) 
{
  var parse = simpleSqlParser.sql2ast(input);
  var table = parse["DELETE FROM"][0];
  var where = parse["WHERE"];
  var tableArray = getTableFromSheet_(table);
  var rows = resolveRowsFromWhere_(tableArray, where, dSelect);
  
  deleteHelp(table, rows);
}

function deleteHelp(tableName, rows)
{
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(tableName);  
  for (var i = 0; i < rows.length; i++)
    sheet.deleteRow(rows[i] - i);
}

function dWhere(tableArray, term)
{
  return resolveRowsByLogic_(tableArray, term, dSelect);
}

function dIntersect(rows0, rows1)
{
  return intersectSortedRows_(rows0, rows1);
}

function dUnion(rows0, rows1)
{
  return unionSortedRows_(rows0, rows1);
}

function dSelect(inputRange, attribute, operator, value)
{
  return selectRowsByComparison_(inputRange, attribute, operator, value);
}
