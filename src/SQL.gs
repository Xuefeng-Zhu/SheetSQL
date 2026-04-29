function onOpen() {
  var ss = SpreadsheetApp.getActive();
  var items = [
    {name: 'Show prompt', functionName: 'showPrompt'},
    {name: 'Clear History', functionName: 'warning'}
  ];
  ss.addMenu('SQL', items);
}

function showPrompt() {
  var result = Browser.inputBox(
      'Google Sheet based SQL',
      'Please enter SQL statement you want to execute:',
      Browser.Buttons.OK_CANCEL);

  if (result != 'cancel') {
    var out = SQL(result);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SQL');
    if (sheet === null) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('SQL');
    }
    sheet.activate();
    for (var i = 0; i < out.length; i++)
      sheet.appendRow(out[i]);
    sheet.appendRow([' ']);
  }
  else {
    Browser.msgBox('Thanks for using! Bye!');
  }
}

function warning(){
  var result = Browser.msgBox(
    'Please confirm',
    'Are you sure you want to clear all the history?',
    Browser.Buttons.YES_NO);

  if (result == 'yes') {
    var sheet = SpreadsheetApp.getActiveSheet();
    sheet.clear();
    Browser.msgBox('History Cleared.');
  } else {
    Browser.msgBox('User Canceled.');
  }
}


/**
* Execute the SQL query
*
* @param {string} Query to be executed
* @return {object} result.
*/

function SQL(input) {
  var statement = String(input || '').trim();
  if (!statement) {
    return [['Syntax invalid: empty statement']];
  }

  var upperStatement = statement.toUpperCase();

  try {
    if (upperStatement.indexOf('SELECT') == 0) {
      var out = [[statement + ' success']];
      out = out.concat(selectQuery(statement));
      return out;
    }

    if (upperStatement.indexOf('CREATE TABLE') == 0) {
      createTable(statement);
      return [[statement + ' success']];
    }

    if (upperStatement.indexOf('DROP TABLE') == 0) {
      dropTable(statement);
      return [[statement + ' success']];
    }

    if (upperStatement.indexOf('ALTER TABLE') == 0) {
      alterTable(statement);
      return [[statement + ' success']];
    }

    if (upperStatement.indexOf('INSERT INTO') == 0) {
      insert(statement);
      return [[statement + ' success']];
    }

    if (upperStatement.indexOf('DELETE FROM') == 0) {
      deleteFrom(statement);
      return [[statement + ' success']];
    }

    if (upperStatement.indexOf('UPDATE') == 0) {
      update(statement);
      return [[statement + ' success']];
    }
  } catch (err) {
    return [['Query failed: ' + err.message]];
  }

  return [['Syntax invalid']];
}

/*
function eliminateDup(input)
{
  var out = [];
  for (var i = 0; i < input.length; i++)
  {
    var repeat = false;
    for (var j = 0; j < out.length; j++)
      if (input[i].join(" ") == out[j].join(" "))
      {
        repeat = true;
        break;
      }
    if (!repeat)
      out.push(input[i]);
  }
  return out;
}
*/
