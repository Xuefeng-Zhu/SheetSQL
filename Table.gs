function createTable(input) {
  input = input.split(" ");
  var name = input[2];
  var attrs = input[3];
  attrs = attrs.slice(1, attrs.length-1).split(",");
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.insertSheet(name, ss.getNumSheets());
  sheet.appendRow(attrs);
  var cells = sheet.getRange(1, 1, 1, attrs.length);
  cells.setFontWeight("bold");
}

function dropTable(input)
{
  input = input.split(" ");
  var tableName = input[2];
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(tableName);
  ss.deleteSheet(sheet);
}

function alterTable(input)
{
  input = input.split(" ");
  var tableName = input[2];
  var operation = input[3];
  var column = input[4];
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(tableName);  
  if (operation.toUpperCase() == "ADD")
  {
    var c = 1;
    var cell = sheet.getRange(1, c);
    while (!cell.isBlank())
    {
      if (cell.getValue() == column)
        throw "The column has exists!";
      c++;
      cell = sheet.getRange(1, c);
    }
    cell.setValue(column);
    cell.setFontWeight("bold");
    return;
  }
  
  if (operation.toUpperCase() == "DROP")
  {
    var c = 1;
    var cell = sheet.getRange(1, c)
    while (cell.getValue() != column)
    {
      if (cell.isBlank())
        throw "The column does not exist!";
      c++;
      cell = sheet.getRange(1, c);
    }
    sheet.deleteColumn(c);
    return;
  }
}