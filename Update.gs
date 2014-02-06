function update(input) {
  var parse = simpleSqlParser.sql2ast(input);
  var table = parse["UPDATE"][0];
  var set = parse["SET"];
  var where = parse["WHERE"];
  var tableArray = getTableFromSheet_(table);
  var rows;
  
  if (where["logic"] == null)
  {
    var attr = where["left"];
    var operator = where["operator"];
    var value = where["right"];
    rows = uSelect(tableArray, attr, operator, value);
  }
  else 
  {
    rows = uWhere(tableArray, where);
  }
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
  var logic = term["logic"];
  var terms = term["terms"];
  var term0 = terms[0];
  var term1 = terms[1];
  var rows0,rows1;
  
  if (term0["logic"] == null)
  {
    var attr = term0["left"];
    var operator = term0["operator"];
    var value = term0["right"];
    rows0 = uSelect(tableArray, attr, operator, value);  
  }
  else
  {
    rows0 = uWhere(tableArray, term0);
  }
  if (term1["logic"] == null)
  {
    var attr = term1["left"];
    var operator = term1["operator"];
    var value = term1["right"];
    rows1 = uSelect(tableArray, attr, operator, value);  
  }
  else
  {
    rows1 = uWhere(tableArray, term1);
  }
  
  if (logic == "AND")
  {
    return uIntersect(rows0, rows1);
  }
  else if (logic == "OR")
  {
    return uUnion(rows0, rows1);
  }
  
}

function uIntersect(rows0, rows1)
{

  var i = 0; j = 0;
  var out = [];
  while (i < rows0.length && j < rows1.length)
  {
    if (rows0[i] < rows1[j])
      i++;
    else if (rows0[i] > rows1[j])
      j++;
    else 
    {
      out.push(rows0[i]);
      i++;
      j++;
    }
  }
  return out;
}

function uUnion(rows0, rows1)
{
  var i = 0, j = 0;
  while (j < rows1.length)
  {
    if (rows0[i] < rows1[j])
    {  
      i++;
      if (i == rows0.length)
      {
        rows0 = rows0.concat(rows1.slice(j));
        break;
      }
    }
    else if (rows0[i] > rows1[j])
    {
      rows0.splice(i,0, rows1[j]);
      i++;
      j++;
    }
    else 
    {
      i++;
      j++;
    }
  }
  return rows0;
}


function uSelect(inputRange, attribute, operator, value)
{
  var data =  inputRange;

  /* Get the index for the attribute, to be used later on */  
  var attribute_idx = findInArray_(data[1], attribute);
  if (attribute_idx == -1)
    throw "Invalid attribute : " + attribute;
  
  /* Validate the operator */
  if (operator!="<" && operator!=">" && operator!="=" && operator!=">=" && operator!="<=")
    throw "Invalid operator : " + operator;
  
  /* Array to gather the output of the operator */
  var out=[];
  
  /* Copy the data that matches the condition */
  for (var i = 2; i < data.length; i++) {
    var match = false;
    if (operator=="<")
      match = data[i][attribute_idx] < value;
    else if (operator==">")
      match = data[i][attribute_idx] > value;
    else if (operator==">=")
      match = data[i][attribute_idx] >= value;
    if (operator=="<=")
      match = data[i][attribute_idx] <= value;
    else
      match = data[i][attribute_idx] == value;
    
    /* If the tuple matches the condition append it to output */
    if (match)
      out.push(i);
  }
  return out;
}
