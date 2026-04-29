'use strict';

const fc = require('fast-check');
const assert = require('assert');
const vm = require('vm');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Load simpleSqlParser via vm sandbox (same as production usage)
// ---------------------------------------------------------------------------
const source = fs.readFileSync('src/SimpleSQL.gs', 'utf8');
const sandbox = { console: console };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const simpleSqlParser = sandbox.simpleSqlParser;

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('PASS: ' + name);
  } catch (e) {
    failed++;
    console.error('FAIL: ' + name);
    console.error('  ' + (e.message || e));
    if (e.counterexample) {
      console.error('  Counterexample: ' + JSON.stringify(e.counterexample));
    }
  }
}

// ---------------------------------------------------------------------------
// Task 9.1: Generators for valid SQL statements
// ---------------------------------------------------------------------------

/**
 * Table name generator: alphanumeric identifiers starting with a letter.
 * Examples: employees, t1, orders_2024
 */
const tableNameArb = fc.tuple(
  fc.constantFrom('a','b','c','d','e','f','g','h','t','u','v','w'),
  fc.stringOf(
    fc.constantFrom('a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','0','1','2','3','4','5','_'),
    { minLength: 0, maxLength: 8 }
  )
).map(function([first, rest]) {
  return first + rest;
});

/**
 * Column name generator: alphanumeric identifiers starting with a letter.
 * Examples: name, col1, age
 */
const columnNameArb = fc.tuple(
  fc.constantFrom('a','b','c','d','e','f','g','h','i','j','k','l','m','n','x','y','z'),
  fc.stringOf(
    fc.constantFrom('a','b','c','d','e','f','g','h','i','j','k','0','1','2','3','_'),
    { minLength: 0, maxLength: 6 }
  )
).map(function([first, rest]) {
  return first + rest;
});

/**
 * Value generator: integers or single-quoted strings.
 * Integers: 0, 42, -7
 * Quoted strings: 'hello', 'world'
 * Avoids special characters that could confuse the parser.
 */
const intValueArb = fc.integer({ min: -999, max: 999 }).map(function(n) {
  return String(n);
});

const stringValueArb = fc.stringOf(
  fc.constantFrom('a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z',' ','0','1','2','3','4','5','6','7','8','9'),
  { minLength: 1, maxLength: 10 }
).map(function(s) {
  return "'" + s + "'";
});

const valueArb = fc.oneof(intValueArb, stringValueArb);

/**
 * Generate a list of unique column names.
 */
function uniqueColumnsArb(minLen, maxLen) {
  return fc.array(columnNameArb, { minLength: maxLen, maxLength: maxLen * 2 })
    .map(function(arr) {
      var unique = [];
      var seen = {};
      for (var i = 0; i < arr.length && unique.length < maxLen; i++) {
        if (!seen[arr[i]]) {
          seen[arr[i]] = true;
          unique.push(arr[i]);
        }
      }
      // Pad if needed
      while (unique.length < minLen) {
        var pad = 'col' + unique.length;
        if (!seen[pad]) {
          seen[pad] = true;
          unique.push(pad);
        }
      }
      return unique;
    })
    .filter(function(arr) { return arr.length >= minLen; });
}

/**
 * Comparison operator for WHERE clauses.
 */
const whereOperatorArb = fc.constantFrom('=', '<', '>', '<=', '>=');

// ---------------------------------------------------------------------------
// INSERT generator
// ---------------------------------------------------------------------------

/**
 * INSERT with columns: INSERT INTO table (col1, col2) VALUES (val1, val2)
 */
const insertWithColumnsArb = fc.tuple(
  tableNameArb,
  uniqueColumnsArb(1, 4)
).chain(function([table, columns]) {
  return fc.tuple(
    fc.constant(table),
    fc.constant(columns),
    fc.array(valueArb, { minLength: columns.length, maxLength: columns.length })
  );
}).map(function([table, columns, values]) {
  return 'INSERT INTO ' + table + ' (' + columns.join(', ') + ') VALUES (' + values.join(', ') + ')';
});

/**
 * INSERT without columns: INSERT INTO table VALUES (val1, val2)
 */
const insertWithoutColumnsArb = fc.tuple(
  tableNameArb,
  fc.array(valueArb, { minLength: 1, maxLength: 4 })
).map(function([table, values]) {
  return 'INSERT INTO ' + table + ' VALUES (' + values.join(', ') + ')';
});

/**
 * Combined INSERT generator.
 */
const insertArb = fc.oneof(insertWithColumnsArb, insertWithoutColumnsArb);

// ---------------------------------------------------------------------------
// UPDATE generator
// ---------------------------------------------------------------------------

/**
 * UPDATE table SET col1=val1, col2=val2 WHERE col3 op val3
 */
const updateArb = fc.tuple(
  tableNameArb,
  uniqueColumnsArb(2, 5)
).chain(function([table, columns]) {
  // Use first N-1 columns for SET, last column for WHERE
  var setCols = columns.slice(0, -1);
  var whereCols = [columns[columns.length - 1]];
  return fc.tuple(
    fc.constant(table),
    fc.constant(setCols),
    fc.array(valueArb, { minLength: setCols.length, maxLength: setCols.length }),
    fc.constant(whereCols[0]),
    whereOperatorArb,
    valueArb
  );
}).map(function([table, setCols, setVals, whereCol, whereOp, whereVal]) {
  var setParts = [];
  for (var i = 0; i < setCols.length; i++) {
    setParts.push(setCols[i] + '=' + setVals[i]);
  }
  return 'UPDATE ' + table + ' SET ' + setParts.join(', ') + ' WHERE ' + whereCol + whereOp + whereVal;
});

// ---------------------------------------------------------------------------
// DELETE generator
// ---------------------------------------------------------------------------

/**
 * DELETE FROM table WHERE col op val
 */
const deleteArb = fc.tuple(
  tableNameArb,
  columnNameArb,
  whereOperatorArb,
  valueArb
).map(function([table, col, op, val]) {
  return 'DELETE FROM ' + table + ' WHERE ' + col + op + val;
});

// =========================================================================
// Task 9.2: Property 15 — DML parse round-trip
// Feature: sql-engine-rebuild, Property 15: DML parse round-trip
// **Validates: Requirements 12.1, 12.2, 12.3**
// =========================================================================

test('Property 15: INSERT parse round-trip', function () {
  fc.assert(
    fc.property(
      insertArb,
      function (sql) {
        // Step 1: Parse the generated SQL
        var ast1 = simpleSqlParser.sql2ast(sql);

        // Step 2: Unparse back to SQL
        var unparsed = simpleSqlParser.ast2sql(ast1);

        // Step 3: Parse the unparsed SQL again
        var ast2 = simpleSqlParser.sql2ast(unparsed);

        // Step 4: Compare the two ASTs for semantic equivalence
        var json1 = JSON.stringify(ast1);
        var json2 = JSON.stringify(ast2);
        assert.strictEqual(json1, json2,
          'INSERT round-trip AST mismatch.\n  Original SQL: ' + sql +
          '\n  Unparsed SQL: ' + unparsed);
      }
    ),
    { numRuns: 100, verbose: true }
  );
});

test('Property 15: UPDATE parse round-trip', function () {
  fc.assert(
    fc.property(
      updateArb,
      function (sql) {
        // Step 1: Parse the generated SQL
        var ast1 = simpleSqlParser.sql2ast(sql);

        // Step 2: Unparse back to SQL
        var unparsed = simpleSqlParser.ast2sql(ast1);

        // Step 3: Parse the unparsed SQL again
        var ast2 = simpleSqlParser.sql2ast(unparsed);

        // Step 4: Compare the two ASTs for semantic equivalence
        var json1 = JSON.stringify(ast1);
        var json2 = JSON.stringify(ast2);
        assert.strictEqual(json1, json2,
          'UPDATE round-trip AST mismatch.\n  Original SQL: ' + sql +
          '\n  Unparsed SQL: ' + unparsed);
      }
    ),
    { numRuns: 100, verbose: true }
  );
});

test('Property 15: DELETE parse round-trip', function () {
  fc.assert(
    fc.property(
      deleteArb,
      function (sql) {
        // Step 1: Parse the generated SQL
        var ast1 = simpleSqlParser.sql2ast(sql);

        // Step 2: Unparse back to SQL
        var unparsed = simpleSqlParser.ast2sql(ast1);

        // Step 3: Parse the unparsed SQL again
        var ast2 = simpleSqlParser.sql2ast(unparsed);

        // Step 4: Compare the two ASTs for semantic equivalence
        var json1 = JSON.stringify(ast1);
        var json2 = JSON.stringify(ast2);
        assert.strictEqual(json1, json2,
          'DELETE round-trip AST mismatch.\n  Original SQL: ' + sql +
          '\n  Unparsed SQL: ' + unparsed);
      }
    ),
    { numRuns: 100, verbose: true }
  );
});

// =========================================================================
// Summary
// =========================================================================

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  process.exit(1);
}
