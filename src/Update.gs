function update(input) {
  var parse = simpleSqlParser.sql2ast(input);
  var table = parse["UPDATE"][0];
  var set = parse["SET"];
  var where = parse["WHERE"];
  var tableArray = getTableFromSheet_(table);
  var rows = resolveRowsFromWhere_(tableArray, where, uSelect);
  updateHelp(table, rows, set);
}

function updateHelp(tableName, rows, set)
{
  var data = getTableFromSheet_(tableName);
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(tableName);  

  
  for (var i = 0; i < set.length; i++)
  {
    var temp = set[i].split("=");
    var attribute = temp[0];
    var value = temp[1];
    var attribute_idx = findInArray_(data[1], attribute);
    for (var j = 0; j < rows.length; j++)
    {
      sheet.getRange(rows[j], attribute_idx + 1).setValue(value);
    }
  }
}


function uWhere(tableArray, term)
{
  return resolveRowsByLogic_(tableArray, term, uSelect);
}

function uIntersect(rows0, rows1)
{
  return intersectSortedRows_(rows0, rows1);
}

function uUnion(rows0, rows1)
{
  return unionSortedRows_(rows0, rows1);
}


function uSelect(inputRange, attribute, operator, value)
{
  return selectRowsByComparison_(inputRange, attribute, operator, value);
}
