function insert(input) {
  var parse = simpleSqlParser.sql2ast(input);
  var insert = parse["INSERT INTO"];
  var table = insert["table"];
  var columns = insert["columns"];
  var values = parse["VALUES"][0];
  if (columns == null)
    insertHelper1(table, values);
  else
    insertHelper2(table, columns, values);
}

function insertHelper1(table, values)
{
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(table);
  var c = 1;
  while (!sheet.getRange(1, c).isBlank())
    c++;
  
  if (c - 1 != values.length)
    throw "The number of columns does not match"
  
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(table);
  sheet.appendRow(values);

}

function insertHelper2(table, columns, values)
{
  if (columns.length != values.length)
    throw "The number of colums does not match the number of values";
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(table);
  var temp = [];
  var c = 1;
  var i = 0;
  var cell = sheet.getRange(1, c);
  while (!cell.isBlank())
  {
    if (cell.getValue() == columns[i])
    {
      temp.push( values[i]);
      i++;
    }
    else 
      temp.push(" ");
    c++;
    cell = sheet.getRange(1, c);
  }
  
  if (i != columns.length)
    throw "The columns do not match";
  
  sheet.appendRow(temp);
}
