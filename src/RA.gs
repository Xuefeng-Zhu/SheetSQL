function selectQuery(input) {
//  input = "SELECT * FROM Customers WHERE Country IN ('dasda')"
  var parse = null;
  if (typeof input == "string")
    parse = SQLParser.parse(input);
  else 
    parse = input;
  
  var source = parse["source"]["name"]["value"];
  var out;
  if (source == "RANGE")
  {
    var ranges = SpreadsheetApp.getActiveRange();
    out = ranges.getValues();
  }
  else
  {
    out = getTableFromSheet_(source);
  }
    
  var joins = parse["joins"];
  for (var i = 0; i < joins.length; i++)
  {
    var join = joins[i];
    var side = join["side"];
    var table2 = join["right"]["name"]["value"];
    table2 = getTableFromSheet_(table2);
    var conditions = join["conditions"];
    if (conditions["operation"] != "AND" && conditions["operation"] != "OR")
    {
      var operator = new Array(conditions["operation"]);
      var left = conditions["left"]["values"];
      var right = conditions["right"]["values"];
      var keys = [[left[left.length - 1], right[right.length - 1]]];
      var logic = new Array("AND");
      out = ojoin(out, table2, keys, operator, logic, side);
    }
    else 
    {
      var temp = joinHelp(conditions);
      var operator = temp[0];
      var keys = temp[1];
      var logic = ["AND"].concat(temp[2]);
      out = ojoin(out, table2, keys, operator, logic, side);
    }
  }
  
  var where = parse["where"];
  if (where != null)
  {
    var conditions = where["conditions"];
    var rows = null;
    if (conditions["operation"] != "AND" && conditions["operation"] != "OR")
    {
      var operator = conditions["operation"];
      var attr = conditions["left"]["values"][conditions["left"]["values"].length - 1];
      if (operator != "IN")
        var value = conditions["right"]["value"];
      else 
        var value = conditions["right"]; 
      if (conditions["right"]["values"] == null)
        rows = sSelect(out, attr, operator, value);
      else 
        rows = sSelectAttr(out, attr, operator, conditions["right"]["values"])
    }
    else 
    {
      rows = sWhere(out, conditions);
    }
    out = whereHelp(out, rows)
  }
  
  var group = parse["group"];
  var gFields = null;
  if (group != null)
  {
    gFields = group["fields"];
    var gAttrs = [];
    for (var i = 0; i < gFields.length; i++)
    {
      var temp = gFields[i]["values"];
      gAttrs.push(temp[temp.length-1]);
    }
    out = groupM(out, gAttrs);
    
    var having = group["having"];
    if (having != null)
    {
      var hConditions  = having["conditions"];
      if (hConditions["operation"] != "AND")
      {
        var operation = [hConditions["operation"]];
        var left = hConditions["left"];
        var aggfunct = [left["name"]];
        var arguments = left["arguments"][0]["values"];
        var attr = [arguments[arguments.length-1]];
        var value = [hConditions["right"]["value"]];
        out = groupHaving(out, attr, aggfunct, operation, value, gFields.length);
      }
      else 
      {
        var temp = havingHelp(hConditions);
        var operation = temp[0];
        var aggfunct = temp[1];
        var attr = temp[2];
        var value = temp[3];
        out = groupHaving(out, attr, aggfunct, operation, value, gFields.length);
      }
    }
  }
  
  var fields = parse["fields"];
  var star = fields[0]["star"];
  var distinct = parse["distinct"];
  var attrs = [];
  var names = [];
  if (!star)
  {
    for (var i = 0; i < fields.length; i++)
    {
      if (fields[i]["field"]["value"] != null)
        attrs.push(fields[i]["field"]["value"]);
      else 
        attrs.push(fields[i]["field"]);
      names.push(fields[i]["name"]);
    }
  }
  
  if (star)
  {
    if (distinct)
      out = distinctRow(out);
  }
  else 
  {
    if (group == null)
      out = project(out, attrs);
    else
    {
      out = groupProject(out, attrs, gFields.length);
    }
    if (distinct)
      out = selectDistinct(out, attrs[0]);
    for (var i = 0; i < names.length; i++)
    {
      if (names[i] != null)
        out[1][i] = names[i]["value"];
    }
  }
  
  var unions = parse["unions"];
  for (var i = 0; i < unions.length; i++)
  {
    var subQuery = selectQuery(unions[i]["query"]);
    out = union(out, subQuery);
    if (!unions[0]["all"])
    {
      out = distinctRow(out);
    }
  }
  
  var order = parse["order"];
  if (order != null)
  {
    var orderings = order["orderings"];
    var Oattrs = [];
    var directions = [];
    for (var i = 0; i < orderings.length; i++)
    {
      Oattrs.push(orderings[i]["value"]["value"]);
      directions.push(orderings[i]["direction"]);
    }
    out = sorting(out, Oattrs, directions);
  }

  var limit = parse["limit"];
  if (limit == null)
    return out;
  else 
  {
    var temp = limit["value"]["value"]
    return out.slice(0,temp + 2);
  }
}

function havingHelp(conditions)
{
  var operation = conditions["operation"];
  var left = conditions["left"];
  var right = conditions["right"];
  var out0,out1;
  
  if (left["operation"] != "AND")
  {    
    var operator = [left["operation"]];
    var left2 = left["left"];
    var aggfunct = [left2["name"]];
    var arguments = left2["arguments"][0]["values"];
    var attr = [arguments[arguments.length-1]];
    var value = [left["right"]["value"]];
    out0 = new Array(operator, aggfunct, attr, value);
  }
  else
  {
    out0 = havingHelp(left);
  }
  
  if (right["operation"] != "AND")
  {
    var operator = [right["operation"]];
    var left2 = right["left"];
    var aggfunct = [left2["name"]];
    var arguments = left2["arguments"][0]["values"];
    var attr = [arguments[arguments.length-1]];
    var value = [right["right"]["value"]];
    out1 = new Array(operator, aggfunct, attr, value);
  }
  else
  {
    out1 = havingHelp(right);
  }
  
  var operator = out0[0].concat(out1[0]);
  var aggfunct = out0[1].concat(out1[1]);
  var attr = out0[2].concat(out1[2]);
  var value = out0[3].concat(out1[3]);  
  return new Array(operator, aggfunct, attr, value);  
}

function joinHelp(conditions)
{
  var operation = conditions["operation"];
  var left = conditions["left"];
  var right = conditions["right"];
  var out0,out1;
  
  if (left["operation"] != "AND" && left["operation"] != "OR")
  {
    var operator = new Array(left["operation"]);
    var left2 = left["left"]["values"];
    var right2 = left["right"]["values"];
    var keys = [[left2[left2.length - 1], right2[right2.length - 1]]];
    var logic = new Array();
    out0 = new Array(operator, keys, logic);
  }
  else
  {
    out0 = joinHelp(left);
  }
  
  if (right["operation"] != "AND" && right["operation"] != "OR")
  {
    var operator = new Array(right["operation"]);
    var left2 = right["left"]["values"];
    var right2 = right["right"]["values"];
    var keys = [[left2[left2.length - 1], right2[right2.length - 1]]];
    var logic = new Array();
    out1 = new Array(operator, keys, logic);
  }
  else
  {
    out1 = joinHelp(right);
  }
  
  var operator = out0[0].concat(out1[0]);
  var keys = out0[1].concat(out1[1]);
  var logic = out0[2].concat(out1[2]);
  return new Array(operator, keys, logic);
}


function sWhere(tableArray, conditions)
{
  var operation = conditions["operation"];
  var left = conditions["left"];
  var right = conditions["right"];
  var out0,out1;
  
  if (left["operation"] != "AND" && left["operation"] != "OR")
  {
    var operator = left["operation"];
    var attr = left["left"]["values"][left["left"]["values"].length - 1];
    if (operator != "IN")
      var value = left["right"]["value"];
    else 
      var value = left["right"];
    if (left["right"]["values"] == null)
      out0 = sSelect(tableArray, attr, operator, value);
    else 
      out0 = sSelectAttr(tableArray, attr, operator, left["right"]["values"]);
  }
  else
  {
    out0 = sWhere(tableArray, left);
  }
  
  if (right["operation"] != "AND" && right["operation"] != "OR")
  {
    var operator = right["operation"];
    var attr = right["left"]["values"][right["left"]["values"].length - 1];
    if (operator != "IN")
      var value = right["right"]["value"];
    else 
      var value = right["right"];
    if (right["right"]["values"] == null)
      out1 = sSelect(tableArray, attr, operator, value);
    else 
      out1 = sSelect(tableArray, attr, operator, right["right"]["values"]);
  }
  else
  {
    out1 = sWhere(tableArray, right);
  }
  
  if (operation == "AND")
  {
    return sIntersect(out0, out1);
  }
  else if (operation == "OR")
  {
    return sUnion(out0, out1);
  }
  
}


function distinctRow(input)
{
  var hash = new Object();
  var result = [];
  for (var i = 0; i < input.length; i++)
  {
    if (hash[input[i]] == null)
        hash[input[i]] = i;
  }
  
  for (var i in hash)
    result.push(input[hash[i]]);
  
  return result;
}

function selectDistinct(input, attribute)
{
  var hdr = input[1];
  
  var attribute_idx = findInArray_(hdr, attribute);
  if (attribute_idx == -1)
    throw "Invalid attribute : " + attribute

  var out = [];
  // Copy the table name and attribute name 
  out.push(input[0]);
  out.push(input[1]);
  
  var hash = new Object(); 
  //group attribute
  for (var i = 2; i < input.length; i++) 
  {
    if (hash[input[i][attribute_idx]] == null)
      hash[input[i][attribute_idx]] = i
  }
  for (var i in hash)
    out.push(input[hash[i]]);
    
  return out;
}

function whereHelp(input, rows)
{
  var out = [];
  out.push(input[0]);
  out.push(input[1]);
  
  for (var i =0; i < rows.length; i++)
    out.push(input[rows[i]]);
  
  return out;
}

function sIntersect(rows0, rows1)
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

function sUnion(rows0, rows1)
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


function sSelect(inputRange, attribute, operator, value)
{
  var data =  inputRange;

  /* Get the index for the attribute, to be used later on */  
  var attribute_idx = findInArray_(data[1], attribute);
  if (attribute_idx == -1)
    throw "Invalid attribute : " + attribute;
  
  /* Validate the operator */
  if (operator!="<" && operator!=">" && operator!="=" && operator!=">=" && operator!="<=" && operator!="IS" && operator !="IS NOT" && operator != "LIKE" && operator != "IN")
    throw "Invalid operator : " + operator;
  
  if (operator == "IN")
  {
    if (value["value"] != null)
    {
      var values = value["value"];
      value = [];
      for (var i = 0; i < values.length; i++)
        value.push(values[i]["value"]);
    }
    else 
    {
      var subQuery = selectQuery(value["select"]);
      value = [];
      for (var i = 2; i < subQuery.length; i++)
        value.push(subQuery[i][0]);  
    }
  }
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
    else if (operator=="<=")
      match = data[i][attribute_idx] <= value;
    else if (operator=="IS")
      match = data[i][attribute_idx] == " " || data[i][attribute_idx] == "";
    else if (operator=="IS NOT")
      match = data[i][attribute_idx] != " " || data[i][attribute_idx] != "";
    else if (operator=="LIKE")
      match = selectLike(data[i][attribute_idx], value);
    else if (operator=="IN")
    {
      for (var j = 0; j < value.length; j++)
        if (data[i][attribute_idx] == value[j])
        {
          match = true;
          break;
        }
    }
    else
      match = data[i][attribute_idx] == value;
    
    /* If the tuple matches the condition append it to output */
    if (match)
      out.push(i);
  }
  return out;
}

function selectLike(value, pattern)
{
  pattern = pattern.replace(/_/g, ".?");
  pattern = pattern.replace(/%/g, ".*");
  return value.search(new RegExp(pattern)) >= 0;
}

function sSelectAttr(inputRange, attribute1, operator, attribute2)
{
  var data =  inputRange;

  /* Get the index for the attribute, to be used later on */  
  var attribute_idx1 = findInArray_(data[1], attribute1);
  if (attribute_idx1 == -1)
    throw "Invalid attribute : " + attribute1;
  
  attribute2 = attribute2[attribute2.length - 1];
  var attribute_idx2 = findInArray_(data[1], attribute2);
  if (attribute_idx2 == -1)
    throw "Invalid attribute : " + attribute1;
  
  /* Validate the operator */
  if (operator!="<" && operator!=">" && operator!="=" && operator!=">=" && operator!="<=")
    throw "Invalid operator : " + operator;
  
  /* Array to gather the output of the operator */
  var out=[];

  /* Copy the data that matches the condition */
  for (var i = 2; i < data.length; i++) {
    var match = false;
    if (operator=="<")
      match = data[i][attribute_idx1] < data[i][attribute_idx2] ;
    else if (operator==">")
      match = data[i][attribute_idx1] > data[i][attribute_idx2] ;
    else if (operator==">=")
      match = data[i][attribute_idx1] >= data[i][attribute_idx2] ;
    else if (operator=="<=")
      match = data[i][attribute_idx1] <= data[i][attribute_idx2] ;
    else
      match = data[i][attribute_idx1] == data[i][attribute_idx2] ;
    
    /* If the tuple matches the condition append it to output */
    if (match)
      out.push(i);
  }
  return out;
}
