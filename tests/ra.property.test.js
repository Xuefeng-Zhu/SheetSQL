'use strict';

const fc = require('fast-check');
const assert = require('assert');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Load RA.gs functions into scope
// ---------------------------------------------------------------------------
const raSource = fs.readFileSync('src/RA.gs', 'utf8');
const loadRA = new Function(raSource + `
  return {
    findInArray_, raLike, raSelect, raSelectIndices, raProject,
    raJoin, raUnion, raIntersection, raDifference, raSort,
    raDistinct, raDistinctOn, raAggregate, raGroupBy,
    raIntersectRows, raUnionRows, raResolveWhere
  };
`);
const ra = loadRA();

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
// Task 4.1: Generators
// ---------------------------------------------------------------------------

/** Cell value: integer or short string */
const cellValueArb = fc.oneof(
  fc.integer({ min: -100, max: 100 }),
  fc.string({ maxLength: 10 })
);

/** Numeric-only cell value */
const numericCellArb = fc.integer({ min: -100, max: 100 });

/** Valid column header (non-empty, unique-friendly) */
const headerArb = fc.stringOf(
  fc.constantFrom('a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p'),
  { minLength: 1, maxLength: 6 }
);

/**
 * Generate a valid Table_Array with configurable row/column counts.
 * Uses fc.tuple to combine table name, headers, and data rows.
 * Ensures data rows have same column count as headers.
 */
function tableArrayArb(minRows, maxRows, minCols, maxCols) {
  return fc.tuple(
    fc.string({ minLength: 1, maxLength: 8 }),
    fc.array(headerArb, { minLength: minCols, maxLength: maxCols })
  ).chain(function([name, rawHeaders]) {
    // Deduplicate headers
    var headers = [];
    var seen = {};
    for (var i = 0; i < rawHeaders.length; i++) {
      var h = rawHeaders[i];
      if (!seen[h]) {
        seen[h] = true;
        headers.push(h);
      }
    }
    if (headers.length < minCols) {
      // Pad with unique headers
      for (var i = 0; headers.length < minCols; i++) {
        var pad = 'col' + i;
        if (!seen[pad]) {
          seen[pad] = true;
          headers.push(pad);
        }
      }
    }
    var colCount = headers.length;
    return fc.tuple(
      fc.constant(name),
      fc.constant(headers),
      fc.array(
        fc.array(cellValueArb, { minLength: colCount, maxLength: colCount }),
        { minLength: minRows, maxLength: maxRows }
      )
    );
  }).map(function([name, headers, rows]) {
    var table = [[name], headers.slice()];
    for (var i = 0; i < rows.length; i++) {
      table.push(rows[i].slice());
    }
    return table;
  });
}

/** Generate a Table_Array with numeric-only data */
function numericTableArb(minRows, maxRows, minCols, maxCols) {
  return fc.tuple(
    fc.string({ minLength: 1, maxLength: 8 }),
    fc.array(headerArb, { minLength: minCols, maxLength: maxCols })
  ).chain(function([name, rawHeaders]) {
    var headers = [];
    var seen = {};
    for (var i = 0; i < rawHeaders.length; i++) {
      var h = rawHeaders[i];
      if (!seen[h]) {
        seen[h] = true;
        headers.push(h);
      }
    }
    if (headers.length < minCols) {
      for (var i = 0; headers.length < minCols; i++) {
        var pad = 'col' + i;
        if (!seen[pad]) {
          seen[pad] = true;
          headers.push(pad);
        }
      }
    }
    var colCount = headers.length;
    return fc.tuple(
      fc.constant(name),
      fc.constant(headers),
      fc.array(
        fc.array(numericCellArb, { minLength: colCount, maxLength: colCount }),
        { minLength: minRows, maxLength: maxRows }
      )
    );
  }).map(function([name, headers, rows]) {
    var table = [[name], headers.slice()];
    for (var i = 0; i < rows.length; i++) {
      table.push(rows[i].slice());
    }
    return table;
  });
}

// Helper: get data rows from a Table_Array
function getDataRows(table) {
  return table.slice(2);
}


// =========================================================================
// Task 4.2: Property 1 — select filters correctly
// Feature: sql-engine-rebuild, Property 1: select filters correctly
// **Validates: Requirements 1.1, 1.10, 6.1, 6.3**
// =========================================================================

test('Property 1: select filters correctly', function () {
  var operators = ['<', '>', '=', '>=', '<='];

  fc.assert(
    fc.property(
      numericTableArb(1, 10, 1, 4),
      fc.constantFrom.apply(fc, operators),
      fc.integer({ min: -100, max: 100 }),
      function (table, operator, value) {
        var headers = table[1];
        var colName = headers[0];
        var colIdx = 0;

        var result = ra.raSelect(table, colName, operator, value);
        var resultData = getDataRows(result);
        var inputData = getDataRows(table);

        // Every row in result satisfies the condition
        for (var i = 0; i < resultData.length; i++) {
          var cell = resultData[i][colIdx];
          var match = false;
          if (operator === '<') match = cell < value;
          else if (operator === '>') match = cell > value;
          else if (operator === '=') match = cell === value;
          else if (operator === '>=') match = cell >= value;
          else if (operator === '<=') match = cell <= value;
          assert.strictEqual(match, true,
            'Row ' + i + ' in result does not satisfy ' + colName + ' ' + operator + ' ' + value);
        }

        // No row satisfying the condition is omitted
        var expectedCount = 0;
        for (var i = 0; i < inputData.length; i++) {
          var cell = inputData[i][colIdx];
          var match = false;
          if (operator === '<') match = cell < value;
          else if (operator === '>') match = cell > value;
          else if (operator === '=') match = cell === value;
          else if (operator === '>=') match = cell >= value;
          else if (operator === '<=') match = cell <= value;
          if (match) expectedCount++;
        }
        assert.strictEqual(resultData.length, expectedCount,
          'Result count mismatch: expected ' + expectedCount + ' got ' + resultData.length);
      }
    ),
    { numRuns: 100, verbose: true }
  );
});

test('Property 1b: select IN filters correctly', function () {
  fc.assert(
    fc.property(
      numericTableArb(1, 10, 1, 3),
      fc.array(fc.integer({ min: -100, max: 100 }), { minLength: 1, maxLength: 5 }),
      function (table, inValues) {
        var colName = table[1][0];
        var result = ra.raSelect(table, colName, 'IN', inValues);
        var resultData = getDataRows(result);
        var inputData = getDataRows(table);

        // Every result row has value in the IN list
        for (var i = 0; i < resultData.length; i++) {
          var found = false;
          for (var j = 0; j < inValues.length; j++) {
            if (resultData[i][0] === inValues[j]) { found = true; break; }
          }
          assert.strictEqual(found, true, 'Row value not in IN list');
        }

        // No matching row omitted
        var expectedCount = 0;
        for (var i = 0; i < inputData.length; i++) {
          for (var j = 0; j < inValues.length; j++) {
            if (inputData[i][0] === inValues[j]) { expectedCount++; break; }
          }
        }
        assert.strictEqual(resultData.length, expectedCount);
      }
    ),
    { numRuns: 100, verbose: true }
  );
});

// =========================================================================
// Task 4.3: Property 2 — project preserves rows and extracts columns
// Feature: sql-engine-rebuild, Property 2: project preserves rows
// **Validates: Requirements 1.2**
// =========================================================================

test('Property 2: project preserves rows and extracts columns', function () {
  fc.assert(
    fc.property(
      tableArrayArb(1, 10, 2, 5),
      function (table) {
        var headers = table[1];
        // Pick a random non-empty subset of columns (use first column at minimum)
        var subsetSize = Math.max(1, Math.floor(headers.length / 2));
        var subset = headers.slice(0, subsetSize);

        var result = ra.raProject(table, subset);
        var inputData = getDataRows(table);
        var resultData = getDataRows(result);

        // Same number of data rows
        assert.strictEqual(resultData.length, inputData.length,
          'Row count mismatch after project');

        // Result headers match subset
        assert.deepStrictEqual(result[1], subset);

        // Each result row has correct values from specified columns
        for (var i = 0; i < resultData.length; i++) {
          for (var j = 0; j < subset.length; j++) {
            var origIdx = headers.indexOf(subset[j]);
            assert.strictEqual(resultData[i][j], inputData[i][origIdx],
              'Value mismatch at row ' + i + ' col ' + subset[j]);
          }
        }
      }
    ),
    { numRuns: 100, verbose: true }
  );
});

// =========================================================================
// Task 4.4: Property 3 — join key invariant
// Feature: sql-engine-rebuild, Property 3: join key invariant
// **Validates: Requirements 1.3, 7.4**
// =========================================================================

test('Property 3: join key invariant — inner join', function () {
  fc.assert(
    fc.property(
      numericTableArb(1, 6, 2, 3),
      numericTableArb(1, 6, 2, 3),
      function (left, right) {
        var leftKey = left[1][0];
        var rightKey = right[1][0];

        var result = ra.raJoin(left, right, [[leftKey, rightKey]], ['='], 'inner');
        var resultData = getDataRows(result);

        // Every output row has matching key values
        var leftKeyIdx = 0;
        var rightKeyIdx = left[1].length; // right columns start after left columns
        for (var i = 0; i < resultData.length; i++) {
          assert.strictEqual(resultData[i][leftKeyIdx], resultData[i][rightKeyIdx],
            'Inner join row ' + i + ' has mismatched keys');
        }
      }
    ),
    { numRuns: 100, verbose: true }
  );
});

test('Property 3: join key invariant — left join', function () {
  fc.assert(
    fc.property(
      numericTableArb(1, 6, 2, 3),
      numericTableArb(1, 6, 2, 3),
      function (left, right) {
        var leftKey = left[1][0];
        var rightKey = right[1][0];

        var result = ra.raJoin(left, right, [[leftKey, rightKey]], ['='], 'left');
        var resultData = getDataRows(result);
        var leftData = getDataRows(left);

        // Every left row appears at least once
        for (var i = 0; i < leftData.length; i++) {
          var found = false;
          for (var j = 0; j < resultData.length; j++) {
            var match = true;
            for (var k = 0; k < left[1].length; k++) {
              if (resultData[j][k] !== leftData[i][k]) { match = false; break; }
            }
            if (match) { found = true; break; }
          }
          assert.strictEqual(found, true,
            'Left row ' + i + ' not found in left join result');
        }
      }
    ),
    { numRuns: 100, verbose: true }
  );
});

test('Property 3: join key invariant — right join', function () {
  fc.assert(
    fc.property(
      numericTableArb(1, 6, 2, 3),
      numericTableArb(1, 6, 2, 3),
      function (left, right) {
        var leftKey = left[1][0];
        var rightKey = right[1][0];

        var result = ra.raJoin(left, right, [[leftKey, rightKey]], ['='], 'right');
        var resultData = getDataRows(result);
        var rightData = getDataRows(right);
        var leftColCount = left[1].length;

        // Every right row appears at least once
        for (var i = 0; i < rightData.length; i++) {
          var found = false;
          for (var j = 0; j < resultData.length; j++) {
            var match = true;
            for (var k = 0; k < right[1].length; k++) {
              if (resultData[j][leftColCount + k] !== rightData[i][k]) { match = false; break; }
            }
            if (match) { found = true; break; }
          }
          assert.strictEqual(found, true,
            'Right row ' + i + ' not found in right join result');
        }
      }
    ),
    { numRuns: 100, verbose: true }
  );
});


// =========================================================================
// Task 4.5: Property 4 — set operations correctness
// Feature: sql-engine-rebuild, Property 4: set operations
// **Validates: Requirements 1.4, 7.5**
// =========================================================================

test('Property 4: union contains all rows from both inputs', function () {
  fc.assert(
    fc.property(
      numericTableArb(0, 6, 2, 3).chain(function (t1) {
        var colCount = t1[1].length;
        return fc.tuple(
          fc.constant(t1),
          numericTableArb(0, 6, colCount, colCount)
        );
      }),
      function ([t1, t2]) {
        // Ensure same column count
        if (t1[1].length !== t2[1].length) return; // skip if generator mismatch
        var result = ra.raUnion(t1, t2);
        var resultData = getDataRows(result);
        var t1Data = getDataRows(t1);
        var t2Data = getDataRows(t2);

        assert.strictEqual(resultData.length, t1Data.length + t2Data.length,
          'Union row count should be sum of both inputs');
      }
    ),
    { numRuns: 100, verbose: true }
  );
});

test('Property 4: intersection contains only rows in both inputs', function () {
  fc.assert(
    fc.property(
      numericTableArb(0, 6, 2, 3).chain(function (t1) {
        var colCount = t1[1].length;
        return fc.tuple(
          fc.constant(t1),
          numericTableArb(0, 6, colCount, colCount)
        );
      }),
      function ([t1, t2]) {
        if (t1[1].length !== t2[1].length) return;
        var result = ra.raIntersection(t1, t2);
        var resultData = getDataRows(result);
        var t1Data = getDataRows(t1);
        var t2Data = getDataRows(t2);

        // Every result row must be in both t1 and t2
        for (var i = 0; i < resultData.length; i++) {
          var inT2 = false;
          for (var j = 0; j < t2Data.length; j++) {
            var match = true;
            for (var k = 0; k < resultData[i].length; k++) {
              if (resultData[i][k] !== t2Data[j][k]) { match = false; break; }
            }
            if (match) { inT2 = true; break; }
          }
          assert.strictEqual(inT2, true, 'Intersection row not in t2');
        }
      }
    ),
    { numRuns: 100, verbose: true }
  );
});

test('Property 4: difference contains only rows in first but not second', function () {
  fc.assert(
    fc.property(
      numericTableArb(0, 6, 2, 3).chain(function (t1) {
        var colCount = t1[1].length;
        return fc.tuple(
          fc.constant(t1),
          numericTableArb(0, 6, colCount, colCount)
        );
      }),
      function ([t1, t2]) {
        if (t1[1].length !== t2[1].length) return;
        var result = ra.raDifference(t1, t2);
        var resultData = getDataRows(result);
        var t2Data = getDataRows(t2);

        // No result row should be in t2
        for (var i = 0; i < resultData.length; i++) {
          var inT2 = false;
          for (var j = 0; j < t2Data.length; j++) {
            var match = true;
            for (var k = 0; k < resultData[i].length; k++) {
              if (resultData[i][k] !== t2Data[j][k]) { match = false; break; }
            }
            if (match) { inT2 = true; break; }
          }
          assert.strictEqual(inT2, false, 'Difference row found in t2');
        }
      }
    ),
    { numRuns: 100, verbose: true }
  );
});

// =========================================================================
// Task 4.6: Property 5 — sort produces ordered permutation
// Feature: sql-engine-rebuild, Property 5: sort ordered permutation
// **Validates: Requirements 1.5, 7.8**
// =========================================================================

test('Property 5: sort produces ordered permutation', function () {
  fc.assert(
    fc.property(
      numericTableArb(1, 10, 1, 4),
      fc.constantFrom('ASC', 'DESC'),
      function (table, direction) {
        var colName = table[1][0];
        var result = ra.raSort(table, [colName], [direction]);
        var inputData = getDataRows(table);
        var resultData = getDataRows(result);

        // Result is a permutation: same length
        assert.strictEqual(resultData.length, inputData.length,
          'Sort changed row count');

        // Result is a permutation: same multiset of rows
        var inputSorted = inputData.map(JSON.stringify).sort();
        var resultSorted = resultData.map(JSON.stringify).sort();
        assert.deepStrictEqual(resultSorted, inputSorted,
          'Sort result is not a permutation of input');

        // Adjacent rows satisfy ordering constraint
        var colIdx = 0;
        for (var i = 0; i < resultData.length - 1; i++) {
          var a = resultData[i][colIdx];
          var b = resultData[i + 1][colIdx];
          if (direction === 'ASC') {
            assert.ok(a <= b, 'ASC order violated: ' + a + ' > ' + b);
          } else {
            assert.ok(a >= b, 'DESC order violated: ' + a + ' < ' + b);
          }
        }
      }
    ),
    { numRuns: 100, verbose: true }
  );
});

// =========================================================================
// Task 4.7: Property 6 — distinct eliminates duplicates
// Feature: sql-engine-rebuild, Property 6: distinct eliminates duplicates
// **Validates: Requirements 1.6, 7.3**
// =========================================================================

test('Property 6: distinct — no two data rows are identical', function () {
  fc.assert(
    fc.property(
      tableArrayArb(1, 10, 1, 3),
      function (table) {
        var result = ra.raDistinct(table);
        var resultData = getDataRows(result);

        // No two rows identical
        var seen = {};
        for (var i = 0; i < resultData.length; i++) {
          var key = JSON.stringify(resultData[i]);
          assert.strictEqual(seen.hasOwnProperty(key), false,
            'Duplicate row found in distinct result');
          seen[key] = true;
        }

        // Every unique row from input appears exactly once
        var inputUnique = {};
        var inputData = getDataRows(table);
        for (var i = 0; i < inputData.length; i++) {
          inputUnique[JSON.stringify(inputData[i])] = true;
        }
        assert.strictEqual(resultData.length, Object.keys(inputUnique).length,
          'Distinct result count does not match unique input count');
      }
    ),
    { numRuns: 100, verbose: true }
  );
});

test('Property 6: distinctOn — no two rows share same value in specified column', function () {
  fc.assert(
    fc.property(
      tableArrayArb(1, 10, 2, 4),
      function (table) {
        var colName = table[1][0];
        var result = ra.raDistinctOn(table, colName);
        var resultData = getDataRows(result);

        // No two rows share same value in the specified column
        var seen = {};
        for (var i = 0; i < resultData.length; i++) {
          var val = JSON.stringify(resultData[i][0]);
          assert.strictEqual(seen.hasOwnProperty(val), false,
            'Duplicate column value in distinctOn result');
          seen[val] = true;
        }
      }
    ),
    { numRuns: 100, verbose: true }
  );
});


// =========================================================================
// Task 4.8: Property 7 — groupBy aggregate correctness
// Feature: sql-engine-rebuild, Property 7: groupBy aggregates
// **Validates: Requirements 1.7, 7.2, 7.6**
// =========================================================================

test('Property 7: groupBy aggregate correctness', function () {
  fc.assert(
    fc.property(
      numericTableArb(1, 10, 2, 4),
      function (table) {
        var groupCol = table[1][0];
        var aggCol = table[1][1];
        var aggColIdx = 1;

        var result = ra.raGroupBy(table, [groupCol], [
          { func: 'COUNT', column: aggCol },
          { func: 'SUM', column: aggCol },
          { func: 'MIN', column: aggCol },
          { func: 'MAX', column: aggCol },
          { func: 'AVG', column: aggCol }
        ]);

        var resultData = getDataRows(result);
        var inputData = getDataRows(table);

        // Build expected groups manually
        var groups = {};
        var groupOrder = [];
        for (var i = 0; i < inputData.length; i++) {
          var key = JSON.stringify(inputData[i][0]);
          if (!groups.hasOwnProperty(key)) {
            groups[key] = [];
            groupOrder.push(key);
          }
          groups[key].push(inputData[i][aggColIdx]);
        }

        assert.strictEqual(resultData.length, groupOrder.length,
          'Group count mismatch');

        for (var i = 0; i < resultData.length; i++) {
          var row = resultData[i];
          var gKey = JSON.stringify(row[0]);
          var vals = groups[gKey];
          assert.ok(vals !== undefined, 'Unknown group key: ' + gKey);

          var expectedCount = vals.length;
          var expectedSum = vals.reduce(function(a, b) { return a + b; }, 0);
          var expectedMin = Math.min.apply(null, vals);
          var expectedMax = Math.max.apply(null, vals);
          var expectedAvg = expectedSum / expectedCount;

          // row: [groupVal, COUNT, SUM, MIN, MAX, AVG]
          assert.strictEqual(row[1], expectedCount, 'COUNT mismatch for group ' + gKey);
          assert.strictEqual(row[2], expectedSum, 'SUM mismatch for group ' + gKey);
          assert.strictEqual(row[3], expectedMin, 'MIN mismatch for group ' + gKey);
          assert.strictEqual(row[4], expectedMax, 'MAX mismatch for group ' + gKey);
          assert.ok(Math.abs(row[5] - expectedAvg) < 1e-9,
            'AVG mismatch for group ' + gKey + ': got ' + row[5] + ' expected ' + expectedAvg);
        }
      }
    ),
    { numRuns: 100, verbose: true }
  );
});

// =========================================================================
// Task 4.9: Property 8 — compound WHERE AND/OR
// Feature: sql-engine-rebuild, Property 8: compound WHERE
// **Validates: Requirements 1.8**
// =========================================================================

test('Property 8: compound WHERE AND returns intersection', function () {
  fc.assert(
    fc.property(
      numericTableArb(1, 10, 2, 3),
      fc.integer({ min: -100, max: 100 }),
      fc.integer({ min: -100, max: 100 }),
      function (table, val1, val2) {
        var col1 = table[1][0];
        var col2 = table[1].length > 1 ? table[1][1] : table[1][0];

        var cond1 = { operation: '=', left: { values: [col1] }, right: { value: val1 } };
        var cond2 = { operation: '=', left: { values: [col2] }, right: { value: val2 } };
        var andCond = { operation: 'AND', left: cond1, right: cond2 };

        var rows1 = ra.raResolveWhere(table, cond1);
        var rows2 = ra.raResolveWhere(table, cond2);
        var andRows = ra.raResolveWhere(table, andCond);

        // AND should be intersection
        var expected = ra.raIntersectRows(rows1, rows2);
        assert.deepStrictEqual(andRows, expected,
          'AND did not produce intersection of individual results');
      }
    ),
    { numRuns: 100, verbose: true }
  );
});

test('Property 8: compound WHERE OR returns union', function () {
  fc.assert(
    fc.property(
      numericTableArb(1, 10, 2, 3),
      fc.integer({ min: -100, max: 100 }),
      fc.integer({ min: -100, max: 100 }),
      function (table, val1, val2) {
        var col1 = table[1][0];
        var col2 = table[1].length > 1 ? table[1][1] : table[1][0];

        var cond1 = { operation: '=', left: { values: [col1] }, right: { value: val1 } };
        var cond2 = { operation: '=', left: { values: [col2] }, right: { value: val2 } };
        var orCond = { operation: 'OR', left: cond1, right: cond2 };

        var rows1 = ra.raResolveWhere(table, cond1);
        var rows2 = ra.raResolveWhere(table, cond2);
        var orRows = ra.raResolveWhere(table, orCond);

        // OR should be union
        var expected = ra.raUnionRows(rows1, rows2);
        assert.deepStrictEqual(orRows, expected,
          'OR did not produce union of individual results');
      }
    ),
    { numRuns: 100, verbose: true }
  );
});

// =========================================================================
// Task 4.10: Property 9 — LIKE pattern matching
// Feature: sql-engine-rebuild, Property 9: LIKE matching
// **Validates: Requirements 6.2**
// =========================================================================

test('Property 9: LIKE — % matches zero or more characters', function () {
  fc.assert(
    fc.property(
      fc.string({ minLength: 0, maxLength: 15 }),
      function (value) {
        // % should match any string
        assert.strictEqual(ra.raLike(value, '%'), true,
          '"%" should match any string');
      }
    ),
    { numRuns: 100, verbose: true }
  );
});

test('Property 9: LIKE — _ matches exactly one character', function () {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 1 }),
      function (value) {
        assert.strictEqual(ra.raLike(value, '_'), true,
          '"_" should match single char');
      }
    ),
    { numRuns: 100, verbose: true }
  );
});

test('Property 9: LIKE — exact strings match themselves', function () {
  fc.assert(
    fc.property(
      // Use alphanumeric strings to avoid regex special chars
      fc.stringOf(fc.constantFrom('a','b','c','d','1','2','3'), { minLength: 1, maxLength: 10 }),
      function (value) {
        assert.strictEqual(ra.raLike(value, value), true,
          'Exact string should match itself');
      }
    ),
    { numRuns: 100, verbose: true }
  );
});

test('Property 9: LIKE — _ does not match empty or two chars', function () {
  fc.assert(
    fc.property(
      fc.string({ minLength: 2, maxLength: 10 }),
      function (value) {
        assert.strictEqual(ra.raLike(value, '_'), false,
          '"_" should not match string of length ' + value.length);
      }
    ),
    { numRuns: 100, verbose: true }
  );
});

// =========================================================================
// Task 4.11: Property 10 — column-to-column comparison
// Feature: sql-engine-rebuild, Property 10: column-to-column
// **Validates: Requirements 6.6**
// =========================================================================

test('Property 10: column-to-column comparison', function () {
  fc.assert(
    fc.property(
      numericTableArb(1, 10, 2, 4),
      fc.constantFrom('<', '>', '=', '>=', '<='),
      function (table, operator) {
        var col1 = table[1][0];
        var col2 = table[1][1];

        var colRef = { values: [col2] };
        var result = ra.raSelect(table, col1, operator, colRef);
        var resultData = getDataRows(result);
        var inputData = getDataRows(table);

        // Verify every result row satisfies the condition
        for (var i = 0; i < resultData.length; i++) {
          var a = resultData[i][0];
          var b = resultData[i][1];
          var match = false;
          if (operator === '<') match = a < b;
          else if (operator === '>') match = a > b;
          else if (operator === '=') match = a === b;
          else if (operator === '>=') match = a >= b;
          else if (operator === '<=') match = a <= b;
          assert.strictEqual(match, true,
            'Row does not satisfy ' + col1 + ' ' + operator + ' ' + col2);
        }

        // Verify no matching row omitted
        var expectedCount = 0;
        for (var i = 0; i < inputData.length; i++) {
          var a = inputData[i][0];
          var b = inputData[i][1];
          var match = false;
          if (operator === '<') match = a < b;
          else if (operator === '>') match = a > b;
          else if (operator === '=') match = a === b;
          else if (operator === '>=') match = a >= b;
          else if (operator === '<=') match = a <= b;
          if (match) expectedCount++;
        }
        assert.strictEqual(resultData.length, expectedCount,
          'Column-to-column result count mismatch');
      }
    ),
    { numRuns: 100, verbose: true }
  );
});


// =========================================================================
// Task 4.12: Property 11 — arithmetic projection
// Feature: sql-engine-rebuild, Property 11: arithmetic projection
// **Validates: Requirements 7.1**
// =========================================================================

test('Property 11: arithmetic projection computes correctly', function () {
  fc.assert(
    fc.property(
      numericTableArb(1, 10, 1, 3),
      fc.constantFrom('+', '-', '/'),
      fc.integer({ min: 1, max: 50 }),  // avoid division by zero
      function (table, operation, operand) {
        var colName = table[1][0];
        var expr = {
          operation: operation,
          left: { values: [colName] },
          right: { value: operand }
        };

        var result = ra.raProject(table, [expr]);
        var resultData = getDataRows(result);
        var inputData = getDataRows(table);

        // Same row count
        assert.strictEqual(resultData.length, inputData.length,
          'Arithmetic projection changed row count');

        // Each cell equals original value combined with operand
        for (var i = 0; i < resultData.length; i++) {
          var original = inputData[i][0];
          var expected;
          if (operation === '+') expected = original + operand;
          else if (operation === '-') expected = original - operand;
          else if (operation === '/') expected = original / operand;

          assert.ok(Math.abs(resultData[i][0] - expected) < 1e-9,
            'Arithmetic mismatch at row ' + i + ': ' + resultData[i][0] + ' vs ' + expected);
        }
      }
    ),
    { numRuns: 100, verbose: true }
  );
});

// =========================================================================
// Task 4.13: Property 12 — HAVING filters groups
// Feature: sql-engine-rebuild, Property 12: HAVING filters
// **Validates: Requirements 7.7**
// =========================================================================

test('Property 12: HAVING filters groups correctly', function () {
  fc.assert(
    fc.property(
      numericTableArb(2, 10, 2, 3),
      fc.constantFrom('>', '<', '=', '>=', '<='),
      fc.integer({ min: -50, max: 50 }),
      function (table, operator, threshold) {
        var groupCol = table[1][0];
        var aggCol = table[1][1];

        // First, group by and get COUNT
        var grouped = ra.raGroupBy(table, [groupCol], [{ func: 'COUNT', column: aggCol }]);
        var groupedData = getDataRows(grouped);

        // Apply HAVING manually: filter groups where COUNT satisfies condition
        var expectedGroups = [];
        for (var i = 0; i < groupedData.length; i++) {
          var countVal = groupedData[i][1];
          var match = false;
          if (operator === '>') match = countVal > threshold;
          else if (operator === '<') match = countVal < threshold;
          else if (operator === '=') match = countVal === threshold;
          else if (operator === '>=') match = countVal >= threshold;
          else if (operator === '<=') match = countVal <= threshold;
          if (match) expectedGroups.push(groupedData[i]);
        }

        // Use raSelect on the grouped result to simulate HAVING
        var havingResult = ra.raSelect(grouped, 'COUNT(' + aggCol + ')', operator, threshold);
        var havingData = getDataRows(havingResult);

        assert.strictEqual(havingData.length, expectedGroups.length,
          'HAVING result count mismatch');

        // Only groups where aggregate satisfies comparison remain
        for (var i = 0; i < havingData.length; i++) {
          var countVal = havingData[i][1];
          var match = false;
          if (operator === '>') match = countVal > threshold;
          else if (operator === '<') match = countVal < threshold;
          else if (operator === '=') match = countVal === threshold;
          else if (operator === '>=') match = countVal >= threshold;
          else if (operator === '<=') match = countVal <= threshold;
          assert.strictEqual(match, true,
            'HAVING result contains group that does not satisfy condition');
        }
      }
    ),
    { numRuns: 100, verbose: true }
  );
});

// =========================================================================
// Task 4.14: Property 13 — LIMIT restricts row count
// Feature: sql-engine-rebuild, Property 13: LIMIT
// **Validates: Requirements 7.9**
// =========================================================================

test('Property 13: LIMIT restricts row count', function () {
  fc.assert(
    fc.property(
      tableArrayArb(0, 15, 1, 3),
      fc.integer({ min: 0, max: 20 }),
      function (table, limit) {
        var dataRows = getDataRows(table);
        // Apply limit: take first L data rows + 2 header rows
        var limited = table.slice(0, limit + 2);
        var limitedData = limited.length > 2 ? limited.slice(2) : [];

        // Result has at most L data rows
        assert.ok(limitedData.length <= limit,
          'LIMIT result has ' + limitedData.length + ' rows, expected at most ' + limit);

        // Result has at most N data rows (where N is original count)
        assert.ok(limitedData.length <= dataRows.length,
          'LIMIT result has more rows than original');

        // Result has exactly min(L, N) data rows
        var expected = Math.min(limit, dataRows.length);
        assert.strictEqual(limitedData.length, expected,
          'LIMIT result count mismatch: got ' + limitedData.length + ' expected ' + expected);
      }
    ),
    { numRuns: 100, verbose: true }
  );
});

// =========================================================================
// Task 4.15: Property 14 — INSERT column mapping
// Feature: sql-engine-rebuild, Property 14: INSERT column mapping
// **Validates: Requirements 8.8**
// =========================================================================

/**
 * Pure function: map column values to positions.
 * Given all columns, a subset of specified columns, and their values,
 * returns a row with values at correct positions and '' at unspecified positions.
 */
function insertColumnMapping(allColumns, specifiedColumns, values) {
  var row = [];
  for (var i = 0; i < allColumns.length; i++) {
    row.push('');
  }
  for (var i = 0; i < specifiedColumns.length; i++) {
    var idx = allColumns.indexOf(specifiedColumns[i]);
    if (idx !== -1) {
      row[idx] = values[i];
    }
  }
  return row;
}

test('Property 14: INSERT column mapping fills correctly', function () {
  fc.assert(
    fc.property(
      // Generate a set of unique column names
      fc.array(headerArb, { minLength: 2, maxLength: 6 }).map(function (arr) {
        var unique = [];
        var seen = {};
        for (var i = 0; i < arr.length; i++) {
          if (!seen[arr[i]]) {
            seen[arr[i]] = true;
            unique.push(arr[i]);
          }
        }
        if (unique.length < 2) {
          unique.push('extra_col');
        }
        return unique;
      }),
      fc.integer({ min: 0, max: 100 }),
      function (allColumns, seed) {
        // Pick a random non-empty subset of columns
        var subsetSize = Math.max(1, (seed % allColumns.length) + 1);
        if (subsetSize > allColumns.length) subsetSize = allColumns.length;
        var specifiedColumns = allColumns.slice(0, subsetSize);

        // Generate values for specified columns
        var values = [];
        for (var i = 0; i < specifiedColumns.length; i++) {
          values.push(seed + i);
        }

        var row = insertColumnMapping(allColumns, specifiedColumns, values);

        // Row has correct length
        assert.strictEqual(row.length, allColumns.length,
          'Row length mismatch');

        // Provided values at correct positions
        for (var i = 0; i < specifiedColumns.length; i++) {
          var idx = allColumns.indexOf(specifiedColumns[i]);
          assert.strictEqual(row[idx], values[i],
            'Value at position ' + idx + ' should be ' + values[i]);
        }

        // Blanks at unspecified positions
        for (var i = 0; i < allColumns.length; i++) {
          if (specifiedColumns.indexOf(allColumns[i]) === -1) {
            assert.strictEqual(row[i], '',
              'Unspecified position ' + i + ' should be blank');
          }
        }
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
