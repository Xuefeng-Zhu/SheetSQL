'use strict';

const assert = require('assert');
const {
  makeTable,
  makeEmployeesTable,
  makeDepartmentsTable,
  makeEmptyTable,
  assertTablesEqual,
  assertTableName,
  assertTableHeaders,
  assertRowCount,
  getDataRows,
  getHeaders,
} = require('./helpers');

// ---------------------------------------------------------------------------
// Load RA.gs functions into scope
// ---------------------------------------------------------------------------
const fs = require('fs');
const raSource = fs.readFileSync('src/RA.gs', 'utf8');

// Use Function constructor to evaluate in the current context (avoids cross-realm issues)
const loadRA = new Function(raSource + `
  return {
    findInArray_, raLike, raSelect, raSelectIndices, raProject,
    raJoin, raUnion, raIntersection, raDifference, raSort,
    raDistinct, raDistinctOn, raAggregate, raGroupBy,
    raIntersectRows, raUnionRows, raResolveWhere
  };
`);
const ra = loadRA();

const findInArray_ = ra.findInArray_;
const raLike = ra.raLike;
const raSelect = ra.raSelect;
const raSelectIndices = ra.raSelectIndices;
const raProject = ra.raProject;
const raJoin = ra.raJoin;
const raUnion = ra.raUnion;
const raIntersection = ra.raIntersection;
const raDifference = ra.raDifference;
const raSort = ra.raSort;
const raDistinct = ra.raDistinct;
const raDistinctOn = ra.raDistinctOn;
const raAggregate = ra.raAggregate;
const raGroupBy = ra.raGroupBy;
const raIntersectRows = ra.raIntersectRows;
const raUnionRows = ra.raUnionRows;
const raResolveWhere = ra.raResolveWhere;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error('FAIL: ' + name);
    console.error('  ' + e.message);
  }
}

// =========================================================================
// Task 3.1: findInArray_ uses strict equality
// =========================================================================

test('findInArray_ finds element with strict equality', function () {
  assert.strictEqual(findInArray_([1, 2, 3], 2), 1);
  assert.strictEqual(findInArray_(['a', 'b', 'c'], 'b'), 1);
});

test('findInArray_ returns -1 when not found', function () {
  assert.strictEqual(findInArray_([1, 2, 3], 4), -1);
});

test('findInArray_ uses strict equality (0 !== "")', function () {
  assert.strictEqual(findInArray_([0], ''), -1);
  assert.strictEqual(findInArray_([''], 0), -1);
  assert.strictEqual(findInArray_([null], undefined), -1);
  assert.strictEqual(findInArray_([0], false), -1);
});

// =========================================================================
// Task 3.10: raLike
// =========================================================================

test('raLike matches exact string', function () {
  assert.strictEqual(raLike('hello', 'hello'), true);
  assert.strictEqual(raLike('hello', 'world'), false);
});

test('raLike % matches zero or more chars', function () {
  assert.strictEqual(raLike('hello', '%'), true);
  assert.strictEqual(raLike('hello', 'h%'), true);
  assert.strictEqual(raLike('hello', '%o'), true);
  assert.strictEqual(raLike('hello', '%ell%'), true);
  assert.strictEqual(raLike('hello', 'x%'), false);
});

test('raLike _ matches exactly one char', function () {
  assert.strictEqual(raLike('hello', 'hell_'), true);
  assert.strictEqual(raLike('hello', '_ello'), true);
  assert.strictEqual(raLike('hello', 'h_llo'), true);
  assert.strictEqual(raLike('hello', 'hell__'), false);
  assert.strictEqual(raLike('hi', 'h_'), true);
  assert.strictEqual(raLike('h', 'h_'), false);
});

test('raLike escapes regex special chars', function () {
  assert.strictEqual(raLike('a.b', 'a.b'), true);
  assert.strictEqual(raLike('axb', 'a.b'), false);
  assert.strictEqual(raLike('a+b', 'a+b'), true);
});

test('raLike is case-sensitive', function () {
  assert.strictEqual(raLike('Hello', 'hello'), false);
  assert.strictEqual(raLike('Hello', 'Hello'), true);
});

// =========================================================================
// Task 3.2: raSelect and raSelectIndices
// =========================================================================

test('raSelectIndices with = uses strict equality', function () {
  var table = makeEmployeesTable();
  var indices = raSelectIndices(table, 'name', '=', 'Alice');
  assert.deepStrictEqual(indices, [2]);
});

test('raSelectIndices with = strict: 0 !== ""', function () {
  var table = makeTable('t', ['val'], [[0], [''], [null]]);
  assert.deepStrictEqual(raSelectIndices(table, 'val', '=', 0), [2]);
  assert.deepStrictEqual(raSelectIndices(table, 'val', '=', ''), [3]);
});

test('raSelectIndices with < operator', function () {
  var table = makeEmployeesTable();
  var indices = raSelectIndices(table, 'salary', '<', 65000);
  assert.deepStrictEqual(indices, [3]); // Bob: 60000
});

test('raSelectIndices with > operator', function () {
  var table = makeEmployeesTable();
  var indices = raSelectIndices(table, 'salary', '>', 80000);
  assert.deepStrictEqual(indices, [4]); // Carol: 90000
});

test('raSelectIndices with >= operator', function () {
  var table = makeEmployeesTable();
  var indices = raSelectIndices(table, 'salary', '>=', 80000);
  assert.deepStrictEqual(indices, [2, 4]); // Alice: 80000, Carol: 90000
});

test('raSelectIndices with <= operator', function () {
  var table = makeEmployeesTable();
  var indices = raSelectIndices(table, 'salary', '<=', 60000);
  assert.deepStrictEqual(indices, [3]); // Bob: 60000
});

test('raSelectIndices with LIKE operator', function () {
  var table = makeEmployeesTable();
  var indices = raSelectIndices(table, 'name', 'LIKE', 'A%');
  assert.deepStrictEqual(indices, [2]); // Alice
});

test('raSelectIndices with IN operator', function () {
  var table = makeEmployeesTable();
  var indices = raSelectIndices(table, 'dept', 'IN', ['Sales', 'Marketing']);
  assert.deepStrictEqual(indices, [3, 5, 6]); // Bob, Dave, Eve
});

test('raSelectIndices with IS operator', function () {
  var table = makeTable('t', ['val'], [['hello'], [''], [' '], [null]]);
  var indices = raSelectIndices(table, 'val', 'IS', null);
  assert.deepStrictEqual(indices, [3, 4, 5]); // '', ' ', null
});

test('raSelectIndices with IS NOT operator', function () {
  var table = makeTable('t', ['val'], [['hello'], [''], [' '], [null]]);
  var indices = raSelectIndices(table, 'val', 'IS NOT', null);
  assert.deepStrictEqual(indices, [2]); // 'hello'
});

test('raSelectIndices throws on invalid attribute', function () {
  var table = makeEmployeesTable();
  assert.throws(function () {
    raSelectIndices(table, 'nonexistent', '=', 1);
  }, /Invalid attribute : nonexistent/);
});

test('raSelectIndices throws on invalid operator', function () {
  var table = makeEmployeesTable();
  assert.throws(function () {
    raSelectIndices(table, 'name', '!=', 'Alice');
  }, /Invalid operator : !=/);
});

test('raSelect returns filtered Table_Array', function () {
  var table = makeEmployeesTable();
  var result = raSelect(table, 'dept', '=', 'Engineering');
  assertTableName(result, 'employees');
  assertTableHeaders(result, ['id', 'name', 'dept', 'salary']);
  assertRowCount(result, 2);
  assert.deepStrictEqual(getDataRows(result), [
    [1, 'Alice', 'Engineering', 80000],
    [3, 'Carol', 'Engineering', 90000],
  ]);
});

// =========================================================================
// Task 3.11: Column-to-column comparison
// =========================================================================

test('raSelectIndices column-to-column comparison', function () {
  var table = makeTable('t', ['a', 'b'], [[1, 2], [3, 3], [5, 4]]);
  var indices = raSelectIndices(table, 'a', '=', { values: ['b'] });
  assert.deepStrictEqual(indices, [3]); // row where a===b (3===3)
});

test('raSelectIndices column-to-column with < operator', function () {
  var table = makeTable('t', ['a', 'b'], [[1, 2], [3, 3], [5, 4]]);
  var indices = raSelectIndices(table, 'a', '<', { values: ['b'] });
  assert.deepStrictEqual(indices, [2]); // 1 < 2
});

// =========================================================================
// Task 3.3: raProject
// =========================================================================

test('raProject extracts specified columns', function () {
  var table = makeEmployeesTable();
  var result = raProject(table, ['name', 'salary']);
  assertTableName(result, 'employees');
  assertTableHeaders(result, ['name', 'salary']);
  assertRowCount(result, 5);
  assert.deepStrictEqual(getDataRows(result)[0], ['Alice', 80000]);
});

test('raProject with arithmetic expression', function () {
  var table = makeTable('t', ['val'], [[10], [20], [30]]);
  var result = raProject(table, [{ operation: '+', left: { values: ['val'] }, right: { value: 5 } }]);
  assertTableHeaders(result, ['val+5']);
  assert.deepStrictEqual(getDataRows(result), [[15], [25], [35]]);
});

test('raProject with aggregate function', function () {
  var table = makeTable('t', ['val'], [[10], [20], [30]]);
  var result = raProject(table, [{ name: 'SUM', arguments: [{ values: ['val'] }] }]);
  assertTableHeaders(result, ['SUM(val)']);
  assert.deepStrictEqual(getDataRows(result), [[60]]);
});

test('raProject throws on invalid attribute', function () {
  var table = makeEmployeesTable();
  assert.throws(function () {
    raProject(table, ['nonexistent']);
  }, /Invalid attribute : nonexistent/);
});

// =========================================================================
// Task 3.4: raJoin
// =========================================================================

test('raJoin inner join', function () {
  var emp = makeEmployeesTable();
  var dept = makeDepartmentsTable();
  var result = raJoin(emp, dept, [['dept', 'dept_name']], ['='], 'inner');
  assertTableName(result, 'employees_departments');
  assert.strictEqual(result[1].length, 6); // 4 emp cols + 2 dept cols
  assertRowCount(result, 5); // all 5 employees match a dept
});

test('raJoin left join with unmatched rows', function () {
  var emp = makeTable('emp', ['id', 'dept'], [[1, 'A'], [2, 'B'], [3, 'C']]);
  var dept = makeTable('dept', ['name', 'loc'], [['A', 'X'], ['B', 'Y']]);
  var result = raJoin(emp, dept, [['dept', 'name']], ['='], 'left');
  assertRowCount(result, 3);
  // Row for dept C should have nulls for right side
  var lastRow = getDataRows(result)[2];
  assert.strictEqual(lastRow[0], 3);
  assert.strictEqual(lastRow[1], 'C');
  assert.strictEqual(lastRow[2], null);
  assert.strictEqual(lastRow[3], null);
});

test('raJoin right join with unmatched rows', function () {
  var emp = makeTable('emp', ['id', 'dept'], [[1, 'A']]);
  var dept = makeTable('dept', ['name', 'loc'], [['A', 'X'], ['B', 'Y']]);
  var result = raJoin(emp, dept, [['dept', 'name']], ['='], 'right');
  assertRowCount(result, 2);
  // Row for dept B should have nulls for left side
  var rows = getDataRows(result);
  var bRow = rows[1];
  assert.strictEqual(bRow[0], null);
  assert.strictEqual(bRow[1], null);
  assert.strictEqual(bRow[2], 'B');
  assert.strictEqual(bRow[3], 'Y');
});

test('raJoin cartesian product when keys is null', function () {
  var t1 = makeTable('t1', ['a'], [[1], [2]]);
  var t2 = makeTable('t2', ['b'], [[3], [4]]);
  var result = raJoin(t1, t2, null, null, 'inner');
  assertRowCount(result, 4); // 2 * 2
});

test('raJoin uses strict equality for = operator', function () {
  var t1 = makeTable('t1', ['a'], [[0]]);
  var t2 = makeTable('t2', ['b'], [['']]);
  var result = raJoin(t1, t2, [['a', 'b']], ['='], 'inner');
  assertRowCount(result, 0); // 0 !== ''
});

// =========================================================================
// Task 3.5: raUnion, raIntersection, raDifference
// =========================================================================

test('raUnion combines all rows', function () {
  var t1 = makeTable('t1', ['a', 'b'], [[1, 2], [3, 4]]);
  var t2 = makeTable('t2', ['a', 'b'], [[5, 6]]);
  var result = raUnion(t1, t2);
  assertRowCount(result, 3);
});

test('raUnion throws on column count mismatch', function () {
  var t1 = makeTable('t1', ['a'], [[1]]);
  var t2 = makeTable('t2', ['a', 'b'], [[1, 2]]);
  assert.throws(function () {
    raUnion(t1, t2);
  }, /Column counts mismatch/);
});

test('raIntersection returns common rows with strict equality', function () {
  var t1 = makeTable('t1', ['a', 'b'], [[1, 2], [3, 4], [5, 6]]);
  var t2 = makeTable('t2', ['a', 'b'], [[3, 4], [7, 8]]);
  var result = raIntersection(t1, t2);
  assertRowCount(result, 1);
  assert.deepStrictEqual(getDataRows(result), [[3, 4]]);
});

test('raIntersection uses strict equality (0 !== "")', function () {
  var t1 = makeTable('t1', ['a'], [[0]]);
  var t2 = makeTable('t2', ['a'], [['']]);
  var result = raIntersection(t1, t2);
  assertRowCount(result, 0);
});

test('raDifference returns rows only in first table', function () {
  var t1 = makeTable('t1', ['a', 'b'], [[1, 2], [3, 4], [5, 6]]);
  var t2 = makeTable('t2', ['a', 'b'], [[3, 4]]);
  var result = raDifference(t1, t2);
  assertRowCount(result, 2);
  assert.deepStrictEqual(getDataRows(result), [[1, 2], [5, 6]]);
});

test('raDifference uses strict equality', function () {
  var t1 = makeTable('t1', ['a'], [[0]]);
  var t2 = makeTable('t2', ['a'], [['']]);
  var result = raDifference(t1, t2);
  assertRowCount(result, 1); // 0 not removed because 0 !== ''
});

// =========================================================================
// Task 3.6: raSort
// =========================================================================

test('raSort ascending', function () {
  var table = makeTable('t', ['name', 'age'], [['Carol', 30], ['Alice', 25], ['Bob', 35]]);
  var result = raSort(table, ['name'], ['ASC']);
  assert.deepStrictEqual(getDataRows(result), [
    ['Alice', 25],
    ['Bob', 35],
    ['Carol', 30],
  ]);
});

test('raSort descending', function () {
  var table = makeTable('t', ['name', 'age'], [['Alice', 25], ['Bob', 35], ['Carol', 30]]);
  var result = raSort(table, ['age'], ['DESC']);
  assert.deepStrictEqual(getDataRows(result), [
    ['Bob', 35],
    ['Carol', 30],
    ['Alice', 25],
  ]);
});

test('raSort multi-column', function () {
  var table = makeTable('t', ['dept', 'name'], [
    ['B', 'Carol'],
    ['A', 'Bob'],
    ['A', 'Alice'],
    ['B', 'Dave'],
  ]);
  var result = raSort(table, ['dept', 'name'], ['ASC', 'ASC']);
  assert.deepStrictEqual(getDataRows(result), [
    ['A', 'Alice'],
    ['A', 'Bob'],
    ['B', 'Carol'],
    ['B', 'Dave'],
  ]);
});

test('raSort is stable', function () {
  var table = makeTable('t', ['key', 'order'], [
    ['A', 1],
    ['A', 2],
    ['A', 3],
  ]);
  var result = raSort(table, ['key'], ['ASC']);
  assert.deepStrictEqual(getDataRows(result), [
    ['A', 1],
    ['A', 2],
    ['A', 3],
  ]);
});

test('raSort does not mutate input', function () {
  var table = makeTable('t', ['val'], [[3], [1], [2]]);
  var original = JSON.stringify(table);
  raSort(table, ['val'], ['ASC']);
  assert.strictEqual(JSON.stringify(table), original);
});

// =========================================================================
// Task 3.7: raDistinct and raDistinctOn
// =========================================================================

test('raDistinct removes duplicate rows', function () {
  var table = makeTable('t', ['a', 'b'], [[1, 2], [3, 4], [1, 2], [5, 6], [3, 4]]);
  var result = raDistinct(table);
  assertRowCount(result, 3);
  assert.deepStrictEqual(getDataRows(result), [[1, 2], [3, 4], [5, 6]]);
});

test('raDistinct uses strict equality via JSON.stringify', function () {
  var table = makeTable('t', ['a'], [[0], [''], [null], [false]]);
  var result = raDistinct(table);
  assertRowCount(result, 4); // all different under strict/JSON
});

test('raDistinctOn keeps first row per unique column value', function () {
  var table = makeTable('t', ['dept', 'name'], [
    ['Eng', 'Alice'],
    ['Sales', 'Bob'],
    ['Eng', 'Carol'],
    ['Sales', 'Dave'],
  ]);
  var result = raDistinctOn(table, 'dept');
  assertRowCount(result, 2);
  assert.deepStrictEqual(getDataRows(result), [
    ['Eng', 'Alice'],
    ['Sales', 'Bob'],
  ]);
});

// =========================================================================
// Task 3.8: raGroupBy and raAggregate
// =========================================================================

test('raAggregate COUNT', function () {
  var data = [[1, 10], [2, 20], [3, 30]];
  assert.strictEqual(raAggregate(data, 1, 'COUNT'), 3);
});

test('raAggregate SUM', function () {
  var data = [[1, 10], [2, 20], [3, 30]];
  assert.strictEqual(raAggregate(data, 1, 'SUM'), 60);
});

test('raAggregate MIN', function () {
  var data = [[1, 30], [2, 10], [3, 20]];
  assert.strictEqual(raAggregate(data, 1, 'MIN'), 10);
});

test('raAggregate MAX', function () {
  var data = [[1, 30], [2, 10], [3, 20]];
  assert.strictEqual(raAggregate(data, 1, 'MAX'), 30);
});

test('raAggregate AVG', function () {
  var data = [[1, 10], [2, 20], [3, 30]];
  assert.strictEqual(raAggregate(data, 1, 'AVG'), 20);
});

test('raGroupBy groups and aggregates', function () {
  var table = makeEmployeesTable();
  var result = raGroupBy(table, ['dept'], [{ func: 'COUNT', column: 'id' }, { func: 'SUM', column: 'salary' }]);
  assertTableHeaders(result, ['dept', 'COUNT(id)', 'SUM(salary)']);
  // Engineering: 2 employees, 170000; Sales: 2 employees, 125000; Marketing: 1 employee, 70000
  var rows = getDataRows(result);
  assert.strictEqual(rows.length, 3);

  // Find Engineering group
  var eng = rows.find(function (r) { return r[0] === 'Engineering'; });
  assert.strictEqual(eng[1], 2);
  assert.strictEqual(eng[2], 170000);

  // Find Sales group
  var sales = rows.find(function (r) { return r[0] === 'Sales'; });
  assert.strictEqual(sales[1], 2);
  assert.strictEqual(sales[2], 125000);
});

// =========================================================================
// Task 3.9: raResolveWhere, raIntersectRows, raUnionRows
// =========================================================================

test('raIntersectRows intersects sorted arrays', function () {
  assert.deepStrictEqual(raIntersectRows([2, 3, 5, 7], [3, 5, 8]), [3, 5]);
  assert.deepStrictEqual(raIntersectRows([], [1, 2]), []);
  assert.deepStrictEqual(raIntersectRows([1, 2], []), []);
});

test('raUnionRows unions sorted arrays', function () {
  assert.deepStrictEqual(raUnionRows([2, 5, 7], [3, 5, 8]), [2, 3, 5, 7, 8]);
  assert.deepStrictEqual(raUnionRows([], [1, 2]), [1, 2]);
  assert.deepStrictEqual(raUnionRows([1, 2], []), [1, 2]);
});

test('raResolveWhere simple condition', function () {
  var table = makeEmployeesTable();
  var conditions = {
    operation: '=',
    left: { values: ['dept'] },
    right: { value: 'Engineering' },
  };
  var indices = raResolveWhere(table, conditions);
  assert.deepStrictEqual(indices, [2, 4]); // Alice, Carol
});

test('raResolveWhere AND condition', function () {
  var table = makeEmployeesTable();
  var conditions = {
    operation: 'AND',
    left: {
      operation: '=',
      left: { values: ['dept'] },
      right: { value: 'Engineering' },
    },
    right: {
      operation: '>',
      left: { values: ['salary'] },
      right: { value: 85000 },
    },
  };
  var indices = raResolveWhere(table, conditions);
  assert.deepStrictEqual(indices, [4]); // Carol: Engineering + salary > 85000
});

test('raResolveWhere OR condition', function () {
  var table = makeEmployeesTable();
  var conditions = {
    operation: 'OR',
    left: {
      operation: '=',
      left: { values: ['dept'] },
      right: { value: 'Marketing' },
    },
    right: {
      operation: '=',
      left: { values: ['name'] },
      right: { value: 'Alice' },
    },
  };
  var indices = raResolveWhere(table, conditions);
  assert.deepStrictEqual(indices, [2, 5]); // Alice (2), Dave (5)
});

test('raResolveWhere IN with literal list', function () {
  var table = makeEmployeesTable();
  var conditions = {
    operation: 'IN',
    left: { values: ['name'] },
    right: { value: [{ value: 'Alice' }, { value: 'Eve' }] },
  };
  var indices = raResolveWhere(table, conditions);
  assert.deepStrictEqual(indices, [2, 6]); // Alice, Eve
});

test('raResolveWhere column-to-column', function () {
  var table = makeTable('t', ['a', 'b'], [[1, 1], [2, 3], [4, 4]]);
  var conditions = {
    operation: '=',
    left: { values: ['a'] },
    right: { values: ['b'] },
  };
  var indices = raResolveWhere(table, conditions);
  assert.deepStrictEqual(indices, [2, 4]); // rows where a === b
});

// =========================================================================
// Summary
// =========================================================================

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  process.exit(1);
}
