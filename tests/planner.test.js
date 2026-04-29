'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------------------------------------------------------------------------
// Load QueryPlanner.gs
// ---------------------------------------------------------------------------
const plannerSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'QueryPlanner.gs'), 'utf8');
const loadPlanner = new Function(plannerSource + `
  return {
    planSelect, planUpdate, planDelete, planInsert,
    extractJoinKeys, parseValue
  };
`);
const planner = loadPlanner();
const { planSelect, planUpdate, planDelete, planInsert, extractJoinKeys, parseValue } = planner;

// ---------------------------------------------------------------------------
// Load SQLParser.gs (vendored, large file — use vm context)
// ---------------------------------------------------------------------------
const sqlParserSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'SQLParser.gs'), 'utf8');
const parserSandbox = {};
vm.createContext(parserSandbox);
vm.runInContext(sqlParserSource, parserSandbox);
const SQLParser = parserSandbox.SQLParser;

// ---------------------------------------------------------------------------
// Load SimpleSQL.gs
// ---------------------------------------------------------------------------
const simpleSqlSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'SimpleSQL.gs'), 'utf8');
const simpleSandbox = { console };
vm.createContext(simpleSandbox);
vm.runInContext(simpleSqlSource, simpleSandbox);
const simpleSqlParser = simpleSandbox.simpleSqlParser;

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error('FAIL: ' + name);
    console.error('  ' + (e.message || e));
  }
}

// =========================================================================
// planSelect tests
// =========================================================================

test('planSelect: simple SELECT * FROM table', function () {
  const ast = SQLParser.parse('SELECT * FROM employees');
  const plan = planSelect(ast);

  assert.strictEqual(plan.source, 'employees');
  assert.strictEqual(plan.joins.length, 0);
  assert.strictEqual(plan.where, null);
  assert.strictEqual(plan.groupBy, null);
  assert.strictEqual(plan.distinct, false);
  assert.strictEqual(plan.unions.length, 0);
  assert.strictEqual(plan.orderBy, null);
  assert.strictEqual(plan.limit, null);
  assert.ok(Array.isArray(plan.fields));
  assert.strictEqual(plan.fields[0].star, true);
});

test('planSelect: SELECT with WHERE clause', function () {
  const ast = SQLParser.parse("SELECT * FROM employees WHERE salary > 50000");
  const plan = planSelect(ast);

  assert.strictEqual(plan.source, 'employees');
  assert.ok(plan.where !== null);
  assert.strictEqual(plan.where.operation, '>');
});

test('planSelect: SELECT with JOIN', function () {
  const ast = SQLParser.parse(
    'SELECT * FROM employees JOIN departments ON employees.dept = departments.name'
  );
  const plan = planSelect(ast);

  assert.strictEqual(plan.joins.length, 1);
  assert.strictEqual(plan.joins[0].table, 'departments');
  assert.deepStrictEqual(plan.joins[0].keys, [['dept', 'name']]);
  assert.deepStrictEqual(plan.joins[0].operators, ['=']);
  assert.strictEqual(plan.joins[0].side, null);
});

test('planSelect: SELECT with LEFT JOIN', function () {
  const ast = SQLParser.parse(
    'SELECT * FROM employees LEFT JOIN departments ON employees.dept = departments.name'
  );
  const plan = planSelect(ast);

  assert.strictEqual(plan.joins.length, 1);
  assert.strictEqual(plan.joins[0].side, 'LEFT');
});

test('planSelect: SELECT with RIGHT JOIN', function () {
  const ast = SQLParser.parse(
    'SELECT * FROM employees RIGHT JOIN departments ON employees.dept = departments.name'
  );
  const plan = planSelect(ast);

  assert.strictEqual(plan.joins.length, 1);
  assert.strictEqual(plan.joins[0].side, 'RIGHT');
});

test('planSelect: SELECT with compound join condition (AND)', function () {
  const ast = SQLParser.parse(
    'SELECT * FROM t1 JOIN t2 ON t1.a = t2.b AND t1.c = t2.d'
  );
  const plan = planSelect(ast);

  assert.strictEqual(plan.joins.length, 1);
  assert.deepStrictEqual(plan.joins[0].keys, [['a', 'b'], ['c', 'd']]);
  assert.deepStrictEqual(plan.joins[0].operators, ['=', '=']);
});

test('planSelect: SELECT with GROUP BY', function () {
  const ast = SQLParser.parse(
    'SELECT dept, COUNT(id) FROM employees GROUP BY dept'
  );
  const plan = planSelect(ast);

  assert.ok(plan.groupBy !== null);
  assert.deepStrictEqual(plan.groupBy.columns, ['dept']);
  assert.strictEqual(plan.groupBy.having, null);
});

test('planSelect: SELECT with GROUP BY and HAVING', function () {
  const ast = SQLParser.parse(
    'SELECT dept, COUNT(id) FROM employees GROUP BY dept HAVING COUNT(id) > 1'
  );
  const plan = planSelect(ast);

  assert.ok(plan.groupBy !== null);
  assert.deepStrictEqual(plan.groupBy.columns, ['dept']);
  assert.ok(plan.groupBy.having !== null);
  assert.strictEqual(plan.groupBy.having.operation, '>');
});

test('planSelect: SELECT with ORDER BY', function () {
  const ast = SQLParser.parse(
    'SELECT * FROM employees ORDER BY name ASC, salary DESC'
  );
  const plan = planSelect(ast);

  assert.ok(plan.orderBy !== null);
  assert.deepStrictEqual(plan.orderBy.columns, ['name', 'salary']);
  assert.deepStrictEqual(plan.orderBy.directions, ['ASC', 'DESC']);
});

test('planSelect: SELECT with LIMIT', function () {
  const ast = SQLParser.parse('SELECT * FROM employees LIMIT 10');
  const plan = planSelect(ast);

  assert.strictEqual(plan.limit, 10);
});

test('planSelect: SELECT DISTINCT', function () {
  const ast = SQLParser.parse('SELECT DISTINCT dept FROM employees');
  const plan = planSelect(ast);

  assert.strictEqual(plan.distinct, true);
});

test('planSelect: SELECT with UNION', function () {
  const ast = SQLParser.parse(
    'SELECT name FROM employees UNION SELECT name FROM contractors'
  );
  const plan = planSelect(ast);

  assert.ok(plan.unions.length > 0);
});

test('planSelect: SELECT from RANGE', function () {
  const ast = SQLParser.parse('SELECT * FROM RANGE');
  const plan = planSelect(ast);

  assert.strictEqual(plan.source, 'RANGE');
});

test('planSelect: SELECT with IN subquery', function () {
  const ast = SQLParser.parse(
    "SELECT * FROM employees WHERE dept IN (SELECT name FROM departments)"
  );
  const plan = planSelect(ast);

  assert.ok(plan.where !== null);
  assert.strictEqual(plan.where.operation, 'IN');
});

test('planSelect: SELECT with specific fields', function () {
  const ast = SQLParser.parse('SELECT name, salary FROM employees');
  const plan = planSelect(ast);

  assert.strictEqual(plan.fields.length, 2);
  assert.strictEqual(plan.fields[0].field.value, 'name');
  assert.strictEqual(plan.fields[1].field.value, 'salary');
});

test('planSelect: SELECT with alias', function () {
  const ast = SQLParser.parse('SELECT name AS employee_name FROM employees');
  const plan = planSelect(ast);

  assert.strictEqual(plan.fields.length, 1);
  assert.strictEqual(plan.fields[0].field.value, 'name');
  assert.ok(plan.fields[0].name !== null);
  assert.strictEqual(plan.fields[0].name.value, 'employee_name');
});

test('planSelect: full query with all clauses', function () {
  const ast = SQLParser.parse(
    'SELECT DISTINCT dept, COUNT(id) FROM employees ' +
    'LEFT JOIN departments ON employees.dept = departments.name ' +
    'WHERE salary > 50000 ' +
    'GROUP BY dept HAVING COUNT(id) > 1 ' +
    'ORDER BY dept ASC ' +
    'LIMIT 5'
  );
  const plan = planSelect(ast);

  assert.strictEqual(plan.source, 'employees');
  assert.strictEqual(plan.joins.length, 1);
  assert.strictEqual(plan.joins[0].side, 'LEFT');
  assert.ok(plan.where !== null);
  assert.ok(plan.groupBy !== null);
  assert.deepStrictEqual(plan.groupBy.columns, ['dept']);
  assert.ok(plan.groupBy.having !== null);
  assert.strictEqual(plan.distinct, true);
  assert.ok(plan.orderBy !== null);
  assert.deepStrictEqual(plan.orderBy.columns, ['dept']);
  assert.strictEqual(plan.limit, 5);
});

// =========================================================================
// extractJoinKeys tests
// =========================================================================

test('extractJoinKeys: simple condition', function () {
  const cond = {
    operation: '=',
    left: { values: ['t1', 'a'] },
    right: { values: ['t2', 'b'] }
  };
  const result = extractJoinKeys(cond);
  assert.deepStrictEqual(result.keys, [['a', 'b']]);
  assert.deepStrictEqual(result.operators, ['=']);
});

test('extractJoinKeys: compound AND condition', function () {
  const cond = {
    operation: 'AND',
    left: {
      operation: '=',
      left: { values: ['a'] },
      right: { values: ['b'] }
    },
    right: {
      operation: '>',
      left: { values: ['c'] },
      right: { values: ['d'] }
    }
  };
  const result = extractJoinKeys(cond);
  assert.deepStrictEqual(result.keys, [['a', 'b'], ['c', 'd']]);
  assert.deepStrictEqual(result.operators, ['=', '>']);
});

// =========================================================================
// planUpdate tests
// =========================================================================

test('planUpdate: simple UPDATE with WHERE', function () {
  const ast = simpleSqlParser.sql2ast("UPDATE employees SET salary=50000 WHERE dept='Engineering'");
  const plan = planUpdate(ast);

  assert.strictEqual(plan.table, 'employees');
  assert.ok(plan.where !== null);
  assert.strictEqual(plan.setAssignments.length, 1);
  assert.strictEqual(plan.setAssignments[0].column, 'salary');
  assert.strictEqual(plan.setAssignments[0].value, 50000);
});

test('planUpdate: UPDATE with multiple SET assignments', function () {
  const ast = simpleSqlParser.sql2ast("UPDATE employees SET salary=60000, dept='Sales'");
  const plan = planUpdate(ast);

  assert.strictEqual(plan.table, 'employees');
  assert.strictEqual(plan.where, null);
  assert.strictEqual(plan.setAssignments.length, 2);
  assert.strictEqual(plan.setAssignments[0].column, 'salary');
  assert.strictEqual(plan.setAssignments[0].value, 60000);
  assert.strictEqual(plan.setAssignments[1].column, 'dept');
  assert.strictEqual(plan.setAssignments[1].value, 'Sales');
});

test('planUpdate: UPDATE without WHERE', function () {
  const ast = simpleSqlParser.sql2ast('UPDATE employees SET salary=0');
  const plan = planUpdate(ast);

  assert.strictEqual(plan.table, 'employees');
  assert.strictEqual(plan.where, null);
  assert.strictEqual(plan.setAssignments[0].value, 0);
});

// =========================================================================
// planDelete tests
// =========================================================================

test('planDelete: simple DELETE with WHERE', function () {
  const ast = simpleSqlParser.sql2ast("DELETE FROM employees WHERE dept='Sales'");
  const plan = planDelete(ast);

  assert.strictEqual(plan.table, 'employees');
  assert.ok(plan.where !== null);
});

test('planDelete: DELETE without WHERE', function () {
  const ast = simpleSqlParser.sql2ast('DELETE FROM employees');
  const plan = planDelete(ast);

  assert.strictEqual(plan.table, 'employees');
  assert.strictEqual(plan.where, null);
});

// =========================================================================
// planInsert tests
// =========================================================================

test('planInsert: INSERT with columns', function () {
  const ast = simpleSqlParser.sql2ast("INSERT INTO employees (name, salary) VALUES ('Alice', 80000)");
  const plan = planInsert(ast);

  assert.strictEqual(plan.table, 'employees');
  assert.strictEqual(plan.columns.length, 2);
  assert.strictEqual(plan.columns[0], 'name');
  assert.strictEqual(plan.columns[1], 'salary');
  assert.strictEqual(plan.values.length, 2);
  assert.strictEqual(plan.values[0], 'Alice');
  assert.strictEqual(plan.values[1], 80000);
});

test('planInsert: INSERT without columns', function () {
  const ast = simpleSqlParser.sql2ast("INSERT INTO employees VALUES (1, 'Bob', 'Sales', 60000)");
  const plan = planInsert(ast);

  assert.strictEqual(plan.table, 'employees');
  assert.strictEqual(plan.columns, null);
  assert.strictEqual(plan.values.length, 4);
  assert.strictEqual(plan.values[0], 1);
  assert.strictEqual(plan.values[1], 'Bob');
  assert.strictEqual(plan.values[2], 'Sales');
  assert.strictEqual(plan.values[3], 60000);
});

test('planInsert: INSERT strips quotes from string values', function () {
  const ast = simpleSqlParser.sql2ast("INSERT INTO t VALUES ('hello', \"world\")");
  const plan = planInsert(ast);

  assert.strictEqual(plan.values[0], 'hello');
  assert.strictEqual(plan.values[1], 'world');
});

test('planInsert: INSERT converts numeric strings to numbers', function () {
  const ast = simpleSqlParser.sql2ast("INSERT INTO t VALUES (42, 3.14, 'text')");
  const plan = planInsert(ast);

  assert.strictEqual(plan.values[0], 42);
  assert.strictEqual(plan.values[1], 3.14);
  assert.strictEqual(plan.values[2], 'text');
});

// =========================================================================
// parseValue tests
// =========================================================================

test('parseValue: strips single quotes', function () {
  assert.strictEqual(parseValue("'hello'"), 'hello');
});

test('parseValue: strips double quotes', function () {
  assert.strictEqual(parseValue('"world"'), 'world');
});

test('parseValue: converts integer string', function () {
  assert.strictEqual(parseValue('42'), 42);
});

test('parseValue: converts float string', function () {
  assert.strictEqual(parseValue('3.14'), 3.14);
});

test('parseValue: returns non-numeric string as-is', function () {
  assert.strictEqual(parseValue('hello'), 'hello');
});

test('parseValue: handles non-string input', function () {
  assert.strictEqual(parseValue(42), 42);
  assert.strictEqual(parseValue(null), null);
});

// =========================================================================
// Summary
// =========================================================================

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  process.exit(1);
}
