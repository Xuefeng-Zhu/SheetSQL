/**
 * Execute a CREATE TABLE statement.
 *
 * Parses with regex and delegates to Sheet_IO.
 *
 * @param {string} input - SQL CREATE TABLE statement
 */
function createTable(input) {
  var match = /^CREATE\s+TABLE\s+([A-Za-z0-9_]+)(?:\s*\(([^)]*)\))?\s*;?$/i.exec(String(input || ''));
  if (!match) {
    throw new Error('Invalid CREATE TABLE syntax');
  }

  var tableName = match[1];
  var attrs = parseAttributeList_(match[2]);
  sheetIO_createSheet(tableName, attrs.length > 0 ? attrs : undefined);
}

/**
 * Execute a DROP TABLE statement.
 *
 * Parses with regex and delegates to Sheet_IO.
 *
 * @param {string} input - SQL DROP TABLE statement
 */
function dropTable(input) {
  var match = /^DROP\s+TABLE\s+([A-Za-z0-9_]+)\s*;?$/i.exec(String(input || ''));
  if (!match) {
    throw new Error('Invalid DROP TABLE syntax');
  }

  var tableName = match[1];
  sheetIO_deleteSheet(tableName);
}

/**
 * Execute an ALTER TABLE statement (ADD or DROP column).
 *
 * Parses with regex and delegates to Sheet_IO.
 *
 * @param {string} input - SQL ALTER TABLE statement
 */
function alterTable(input) {
  var match = /^ALTER\s+TABLE\s+([A-Za-z0-9_]+)\s+(ADD|DROP)\s+([A-Za-z0-9_]+)\s*;?$/i.exec(String(input || ''));
  if (!match) {
    throw new Error('Invalid ALTER TABLE syntax');
  }

  var tableName = match[1];
  var operation = match[2].toUpperCase();
  var column = match[3];

  if (operation === 'ADD') {
    sheetIO_addColumn(tableName, column);
  } else {
    sheetIO_dropColumn(tableName, column);
  }
}

/**
 * Parse a comma-separated attribute list from a CREATE TABLE statement.
 *
 * @param {string|null} rawAttrs - raw attribute string
 * @returns {Array<string>} parsed attribute names
 */
function parseAttributeList_(rawAttrs) {
  if (!rawAttrs) {
    return [];
  }

  var attrs = rawAttrs.split(',');
  var out = [];
  for (var i = 0; i < attrs.length; i++) {
    var attr = attrs[i].replace(/^\s+|\s+$/g, '');
    if (!attr) {
      throw new Error('Invalid attribute list');
    }
    out.push(attr);
  }
  return out;
}
