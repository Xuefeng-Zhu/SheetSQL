/**
* Find an element in array.
*
* @param {array} array where element need to be searched
* @param {object} element that will be searched in the array.
* @return {number} index of the element, -1 if not found.
*/
function findInArray_(arr, ele) {
  for (var i=0; i < arr.length; i++)
    if (arr[i]==ele)
      return i;
  return -1;
}

/**
* Get data from a sheet or a range.
*
* @param {string or range} name of the sheet or a range.
* @return {range} table in form of a 2d array.
*/
function getTableFromSheet_(sheetOrRange)
{
  if (typeof sheetOrRange == "string")
  {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetOrRange);
    if (!sheet)
      throw "Invalid sheet : " + sheetOrRange;
    
    var rows = sheet.getDataRange();
    var numRows = rows.getNumRows();
    var values = rows.getValues();
    
    if (numRows < 1)
      throw "Sheet should atleast have a header";

    /* Array to gather the output of the operator */
    var out=[];

    /* Copy the header, i.e., table name */
    var hdr=[]
    hdr.push(sheetOrRange);
    out.push(hdr);
    
    /* Copy the data */
    for (i in values)
      out.push(values[i]);
    return out;
  }   else  {
    if (sheetOrRange.length < 2)
      throw "Sheet should atleast have a header";
    return sheetOrRange;
  }
}



/**
* Rename the relation name and if required the attributes
* as well.
*
* @param {string or range} name of the sheet or a range.
* @param {string} new relation name.
* @param {array} new attribute names.
* @return {range} table in form of a 2d array.
*/
function rename(inputRange, tableName,  attributes)
{

  /* Array to gather the output of the operator */
  var out = [];
  
  /* Generate the header, i.e., table name */
  var tabel_hdr = [];
  tabel_hdr.push(tableName);
  out.push(tabel_hdr);
  
  var data =  getTableFromSheet_(inputRange);
  /* Validate only column count is same if attribute list is provided */
  /* If attribute counts match copy the header */
  if (attributes) {
    if (typeof attribute_list == "string")
    {
      if (data[1].length != 1)
        throw "Column counts mismatch";
      var hdr = [];
      hdr.push(attributes);
      out.push(hdr);
    } else {
      if (data[1].length != attributes[0].length)
        throw "Column counts mismatch";
      out.push(attributes[0]);
    }
    
    /* Copy the data */
    for (var i=2; i < data.length; i++) 
      out.push(data[i]);
  }  else {
    /* Copy the data */
    for (var i=1; i < data.length; i++) 
      out.push(data[i]);
  }
  return out;
}  

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
      throw "Invalid attribute : " + attributes
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
        throw "Invalid attribute : " + attributes[i];
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
    throw "Column counts mismatch";
  
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

/**
* Select tuples from a table based on given condition.
*
* @param {string or range} name of the sheet or a range for first table.
* @param {string} attribute to be matched.
* @param {string} operator used for maching (<, >, =).
* @param {string or number} value against which the attrubute is compared.
* @return {range} table in form of a 2d array.
*/
function select(inputRange, attribute, operator, value)
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
  
  /* Push the header, table name and attribute names */
  out.push(data[0]);
  out.push(data[1]);

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
    else
      match = data[i][attribute_idx] == value;
    
    /* If the tuple matches the condition append it to output */
    if (match)
      out.push(data[i]);
  }
  return out;
}


/** In case column names are not distinct,
* make them distinct by prefixing them with the table name.
*/
function generateUniqueHeaders_(table1_name, table1_attr, table2_name, table2_attr) {
  /* Array to gather the output of the operator */
  var out=[];
  
  for (var i=0; i < table1_attr.length; i++) {
    if (findInArray_(table2_attr, table1_attr[i]) == -1)
      out.push(table1_attr[i]);
    else 
      out.push(table1_name + "." + table1_attr[i]);
  }
  
  for (var i=0; i < table2_attr.length; i++) {
    if (findInArray_(table1_attr, table2_attr[i]) == -1)
      out.push(table2_attr[i]);
    else 
      out.push(table2_name + "." + table2_attr[i]);
  }
  return out;
}

/**
* Perform a join between two tables based on given keys.
*
* @param {string or range} name of the sheet or a range for first table.
* @param {string or range} name of the sheet or a range for second table.
* @param {array} tuples indicating attributes that are used for join.
* @param {string} specify type of join ("inner", "left")
* @return {range} table in form of a 2d array.
*/
function xjoin(inputRange1, inputRange2, keys, joinType) {
  // Get data from sheets
  table1 = inputRange1;
  table2 = inputRange2;
  
  /* First row is table name */ 
  var out=[];
  var newTableName = table1[0][0] + "_" + table2[0][0];
  var tableNameHdr = [];
  tableNameHdr.push(newTableName)
  out.push(tableNameHdr);
  
  /* Generate Column Names */
 // out.push(generateUniqueHeaders_(table1[0][0], table1[1], table2[0][0], table2[1]));
  out.push(table1[1].concat(table2[1]));
  /****************************************************************/
  /*          Complete the code for the join operator             */
  /****************************************************************/
  var attribute_idx1 = [];
  var attribute_idx2 = [];
  //store keys
  for (var i = 0; keys!=null && i < keys.length; i++)
  {  
   attribute_idx1.push(findInArray_(table1[1], keys[i][0]));
   attribute_idx2.push(findInArray_(table2[1], keys[i][1]));
  
   if (attribute_idx1[i] == -1)
     throw "Invalid attribute : " + keys[i][0];
   if (attribute_idx2[i] == -1)
     throw "Invalid attribute : " + keys[i][1];
  }
  //Do cartesian product when key is not specific 
  if (keys == null){  
   for (var i = 2; i < table1.length; i++) {
     for (var j = 2; j < table2.length; j++){
       out.push(table1[i].concat(table2[j]));
     }
   }
  }
  //Do left join 
  else if (joinType == 'left'){
   for (var i = 2; i < table1.length; i++) {
     var match = false;
     for (var j = 2; j < table2.length; j++){
       var found = true;
       for (var k = 0; k < attribute_idx1.length; k++)
         if (table1[i][attribute_idx1[k]] != table2[j][attribute_idx2[k]]){
           found = false;
           break;
         }
       if (found){
         out.push(table1[i].concat(table2[j]));
         match = true;
       }
     }
     if (!match)
       out.push(table1[i]);
   }
  }
  //Do inner join when type is not specific 
  else{
   for (var i = 2; i < table1.length; i++) {
     for (var j = 2; j < table2.length; j++){
       var found = true;
       for (var k = 0; k < attribute_idx1.length; k++)
         if (table1[i][attribute_idx1[k]] != table2[j][attribute_idx2[k]]){
           found = false;
           break;
         }
       if (found){
         out.push(table1[i].concat(table2[j]));
       }
     }
   }
  }
  return out;
};

/**
* Perform intersection between two tables.
*
* @param {range} name of the sheet or a range for first table.
* @param {range} name of the sheet or a range for second table.
* @return {range} table in form of a 2d array.
*/
function intersection(inputRange1, inputRange2)
{
  // Get data from sheets
  table1 = inputRange1;
  table2 = inputRange2;
  
  /* Validate that column count is same */
  if (table1[1].length != table2[1].length)
    throw "Column counts mismatch";
  
  /* Array to gather the output of the operator */
  var out = [];
  

  for (var i=0; i < table1.length; i++) 
    for (var j=0; j < table2.length; j++) 
    {
      var found = true;
      //check if every attribut is equal
      for (var k=0; k < table1[1].length; k++)
        if (table1[i][k] != table2[j][k])
        {
          found = false;
          break;
        }
      if (found)
      {
        out.push(table1[i]);
        break;
      }
    }
  return out;
}

//Extra Credit Q1
/**
* Perform differnece between two tables.
*
* @param {range} name of the sheet or a range for first table.
* @param {range} name of the sheet or a range for second table.
* @return {range} table in form of a 2d array.
*/
function difference(inputRange1, inputRange2)
{
  // Get data from sheets
  table1 = inputRange1;
  table2 = inputRange2;
  
  /* Validate that column count is same */
  if (table1[1].length != table2[1].length)
    throw "Column counts mismatch";
  
  /* Array to gather the output of the operator */
  var out = [];
  var match = [];
  
  for (var i = 0; i < table1.length; i++)
    match.push(false);
  
  for (var i=2; i < table1.length; i++) 
    for (var j=2; j < table2.length; j++) 
    {
      var found = true;
      //check is every element is equal
      for (var k=0; k < table1[1].length; k++)
        if (table1[i][k] != table2[j][k])
        {
          found = false;
          break;
        }
      //if found equal tuple, mark its index 
      if (found)
      {
        match[i] = true;
        break;
      }
    }
  
  for (var i = 0; i < table1.length; i++)
    if (!match[i])
      out.push(table1[i]);
  return out;
}

//Extra Credit Q2
/**
* group the given attributes in a table.
*
* @param {range} name of the sheet or a range.
* @param {string} attributes that need to be grouped.
* @param {string} aggregation method
* @param {string} attributes that need to be aggrefated 
* @return {range} table in form of a 2d array.

function group(inputRange, attribute1, aggfunct, attribute2)
{
  var data =  inputRange;
  var hdr = data[1];
  
  var attribute_idx1 = findInArray_(hdr, attribute1);
  if (attribute_idx1 == -1)
    throw "Invalid attribute : " + attribute1
  var attribute_idx2 = findInArray_(hdr, attribute2);
  if (attribute_idx2 == -1)
    throw "Invalid attribute : " + attribute2

  if (aggfunct != "sum" && aggfunct != "count" && aggfunct != "min"  && aggfunct != "max")
    throw "Invalid type : " + aggfunct
    
  var out = [];
  var group = []
  // Copy the table name and attribute name 
  out.push(data[0]);
  out.push([data[1][attribute_idx1],aggfunct + "("+ (data[1][attribute_idx2]) + ")" ]);

  //group attribute1
  for (var i = 2; i < data.length; i++) 
  {
    var newattr = true;
    //search if group exists
    for (var j = 0; j < group.length; j++)
      if (group[j][0] == data[i][attribute_idx1])
      {
        group[j].push(i);
        newattr = false;
        break;
      }
    //create new group if getting a new attribute 
    if (newattr)
      group.push([data[i][attribute_idx1],i]);
  } 
  //find min
  if (aggfunct == 'min')
  {
     for (var i = 0; i < group.length; i++)
    {
      var min = Number.MAX_VALUE;
      for (var j = 1; j < group[i].length; j++)
      {
        var temp = data[group[i][j]][attribute_idx2];
        if (temp && temp < min)
          min = temp;
      }
      out.push([group[i][0],min]);
    }
  }
  //find max
  else if (aggfunct == "max")
  {
    for (var i = 0; i < group.length; i++)
      {
        var max = Number.MIN_VALUE;
        for (var j = 1; j < group[i].length; j++)
        {
          var temp = data[group[i][j]][attribute_idx2];
          if (temp && temp > max)
            max = temp;
        }
        out.push([group[i][0],max]);
      }
  }
  //find count 
  else if (aggfunct == "count")
  {
    for (var i = 0; i < group.length; i++)
      {
        var count = 0;
        for (var j = 1; j < group[i].length; j++)
        {
          var temp = data[group[i][j]][attribute_idx2];
          if (temp)
            count++;
        }
        out.push([group[i][0],count]);
      }
  }
  //find sum
  else if (aggfunct == "sum")
  {
    for (var i = 0; i < group.length; i++)
      {
        var sum = 0;
        for (var j = 1; j < group[i].length; j++)
        {
          var temp = data[group[i][j]][attribute_idx2];
          if (temp)
            sum += temp;
        }
        out.push([group[i][0],sum]);
      }
  }  
    return out;
}
*/
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
      throw "Invalid attribute : " + attributes[i];
  }
  var out = [];
  out.push(data[0]);
  out.push(data[1]);
  
  var hash = new Object();
  /*
  if (attribute_idx.length > 0)
  {
    for(var i = 2; i < data.length; i++)
    {
      if (hash[data[i][attribute_idx[0]]] == null)
        hash[data[i][attribute_idx[0]]] = new Array(data[i]);
      else 
        hash[data[i][attribute_idx[0]]].push(data[j]);
    }
  }
  */
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
      throw "Invalid attribute : " + attrs[i];
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
//Extra Credit Q3
/**
* sort the given attributes in a table.
*
* @param {string or range} name of the sheet or a range.
* @param {array} attributes that need to be sorted.
* @param {array} orders that want the range to be sorted 
* @return {range} table in form of a 2d array.
*/
function sorting(inputRange, attributes, order)
{
  var data =  inputRange;
  var hdr = data[1];
  
  //store all attributes 
  var attribute_idx = [];
  for (var i = 0; i < attributes.length; i++)
  {
    attribute_idx.push(findInArray_(hdr, attributes[i]));
    if (attribute_idx[i] == -1)
      throw "Invalid attribute : " + attributes[i];
  }
  var out = [];
  
  for (var i = 2; i < data.length - 1; i++) 
  {
    var next = i;
    for (var j = i + 1; j < data.length; j++)
    {
      var isnext = false;
      //check attribute until a min found 
      for (var k =0; k < attribute_idx.length; k++)
      {
        var index = attribute_idx[k];
        if (data[j][index] == null)
           break;
        if (order[k] == "ASC")
        {
          if (data[j][index] < data[next][index])
          {
            isnext = true;
            break;
          }
          else if (data[j][index] > data[next][index])
            break;
        }
        else if (order[k] == "DESC")
        {
          if (data[j][index] > data[next][index])
          {
            isnext = true;
            break;
          }
          else if (data[j][index] < data[next][index])
            break;
        }
      }
      if (isnext)
        next = j;
    }
    //swap
    var temp = data[next];
    data[next] = data[i];
    data[i] = temp;
  }
 

  for (var i = 0; i < data.length; i++)
    out.push(data[i]);
  return out;
}

//Extra Credit Q4
/**
* Perform a outer join between two tables based on given keys.
*
* @param {string or range} name of the sheet or a range for first table.
* @param {string or range} name of the sheet or a range for second table.
* @param {array} tuples indicating attributes that are used for join.
* @param {string} specify type of join ("full", "left", "left") if no type, it will do full outer join
* @return {range} table in form of a 2d array.
*/
function ojoin(inputRange1, inputRange2, keys, operators, logics, joinType) {
  // Get data from sheets
  table1 = getTableFromSheet_(inputRange1);
  table2 = getTableFromSheet_(inputRange2);
  
  /* First row is table name */ 
  var out=[];
  var newTableName = table1[0][0] + "_" + table2[0][0];
  var tableNameHdr = [];
  tableNameHdr.push(newTableName)
  out.push(tableNameHdr);
  
  /* Generate Column Names */
 // out.push(generateUniqueHeaders_(table1[0][0], table1[1], table2[0][0], table2[1]));
  out.push(table1[1].concat(table2[1]));
  /****************************************************************/
  /*          Complete the code for the join operator             */
  /****************************************************************/
  var attribute_idx1 = [];
  var attribute_idx2 = [];
  //store keys
  for (var i = 0; i < keys.length; i++)
  {  
   attribute_idx1.push(findInArray_(table1[1], keys[i][0]));
   attribute_idx2.push(findInArray_(table2[1], keys[i][1]));
  
   if (attribute_idx1[i] == -1)
     throw "Invalid attribute : " + keys[i][0];
   if (attribute_idx2[i] == -1)
     throw "Invalid attribute : " + keys[i][1];
  }
  
  //mark condition of table1 and table2 
  var left = [];
  var right = [];
  
  for (var i = 0; i < table1.length; i++)
    left.push(false);
  for (var i = 0; i < table2.length; i++)
    right.push(false);
  //Do cartesian product when key is not specific 
  if (keys == null){  
    for (var i = 2; i < table1.length; i++) {
      for (var j = 2; j < table2.length; j++){
        out.push(table1[i].concat(table2[j]));
     }
   }
  }
  //Do inner join and mark condition of table1 and table2
  else{
   for (var i = 2; i < table1.length; i++) {
     for (var j = 2; j < table2.length; j++){
       var found = true;
       for (var k = 0; k < attribute_idx1.length; k++)
       {
         if (dismatch(table1[i][attribute_idx1[k]], table2[j][attribute_idx2[k]], operators[k])){
           found = false;
         }
         else if (logics[k] == "OR")
         {
           found = true;
         }
       }
       if (found){
         out.push(table1[i].concat(table2[j]));
         left[i] = true;
         right[j] = true;
       }
     }
   }
  }
  if (joinType == "left"){
    for (var i = 2; i < left.length; i++)
      if (!left[i])
        out.push(table1[i]);
  }
  else if (joinType == "right"){
    for (var i = 2; i < right.length; i++)
      if (!right[i])
        out.push(new Array(table1[1].length).concat(table2[i]));
  }
  /*
  else {
    for (var i = 2; i < left.length; i++)
      if (!left[i])
        out.push(table1[i]);
    for (var i = 2; i < right.length; i++)
      if (!right[i])
        out.push(new Array(table1[1].length).concat(table2[i]));    
  }
  */
  return out;
}

function dismatch(attr1, attr2, operator)
{
  if (operator=="<")
    return attr1 >= attr2;
  else if (operator==">")
    return attr1 <= attr2;
  else if (operator==">=")
    return attr1 < attr2;
  else if (operator=="<=")
    return attr1 > attr2;
  else
    return attr1 != attr2;
}

//Extra Credit Q5
/**
* Select a distinct tuple from a table based on given attribute. This function is useful since it could get rid of same attributes  
*
* @param {array} table data.
* @param {string} attributes that need to be selected.
* @return {range} table in form of an array.
*/
function selectdistinct(inputRange, attribute)
{
  var data =  inputRange;
  var hdr = data[1];
  
  var attribute_idx = findInArray_(hdr, attribute);
  if (attribute_idx == -1)
    throw "Invalid attribute : " + attribute

  var out = [];
  var group = []
  // Copy the table name and attribute name 
  out.push(data[0]);
  out.push(data[1]);

  //group attribute
  for (var i = 2; i < data.length; i++) 
  {
    var newattr = true;
    //search if group exists
    for (var j = 0; j < group.length; j++)
      if (group[j][0] == data[i][attribute_idx])
      {
        group[j].push(i);
        newattr = false;
        break;
      }
    //create new group if getting a new attribute 
    if (newattr)
      group.push([data[i][attribute_idx],i]);
  }
  for (var i =0; i < group.length; i++)
    out.push(data[group[i][1]]);
    
  return out;
}

