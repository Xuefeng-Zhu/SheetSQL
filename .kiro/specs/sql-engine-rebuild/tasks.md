# Tasks

## Task 1: Set up testing infrastructure and install fast-check

- [x] 1.1 Add `fast-check` as a dev dependency in `package.json`
- [x] 1.2 Create `tests/helpers.js` with shared test utilities: Table_Array generators, SpreadsheetApp mock factory, and assertion helpers
- [x] 1.3 Verify existing tests still pass with `npm test`

## Task 2: Implement Sheet_IO layer (`src/SheetIO.gs`)

- [x] 2.1 Create `src/SheetIO.gs` with `sheetIO_readTable` that reads a sheet by name using `getDataRange().getValues()` and returns a Table_Array; throws `Error("Invalid sheet : " + name)` if sheet missing, `Error("Sheet should atleast have a header")` if empty
- [x] 2.2 Implement `sheetIO_readRange` that reads the active selection and returns a Table_Array with `["RANGE"]` as the table name header
- [x] 2.3 Implement `sheetIO_writeRows` that writes a 2D array to a sheet using a single `setValues` call
- [x] 2.4 Implement `sheetIO_deleteRows` that removes row indices from a sheet in descending order
- [x] 2.5 Implement `sheetIO_updateCells` that writes changed cell values using batched `setValues`
- [x] 2.6 Implement `sheetIO_createSheet`, `sheetIO_deleteSheet`, `sheetIO_addColumn`, `sheetIO_dropColumn` for DDL operations
- [x] 2.7 Implement `sheetIO_getOrCreateSqlSheet` and `sheetIO_appendOutputRows` for history sheet management
- [x] 2.8 Write integration tests in `tests/sheetio.test.js` with mocked SpreadsheetApp verifying batched I/O and error messages

## Task 3: Rewrite RA_Core pure functions (`src/RA.gs`)

- [x] 3.1 Rewrite `findInArray_` to use strict equality (`===`)
- [x] 3.2 Implement `raSelect` that filters a Table_Array by attribute/operator/value, supporting `<`, `>`, `=`, `>=`, `<=`, `LIKE`, `IN`, `IS`, `IS NOT` operators; and `raSelectIndices` that returns matching row indices
- [x] 3.3 Implement `raProject` that extracts specified columns from a Table_Array, supporting string column names and arithmetic expression objects
- [x] 3.4 Implement `raJoin` supporting inner, left, and right joins with multiple key pairs and operators
- [x] 3.5 Implement `raUnion`, `raIntersection`, `raDifference` set operations with column count validation using strict equality
- [x] 3.6 Implement `raSort` using a stable comparison sort with multi-column ASC/DESC support
- [x] 3.7 Implement `raDistinct` (full row dedup) and `raDistinctOn` (single column dedup)
- [x] 3.8 Implement `raGroupBy` with SUM, COUNT, MIN, MAX, AVG aggregates and `raAggregate` helper
- [x] 3.9 Implement `raResolveWhere` for compound AND/OR condition trees using `raIntersectRows` and `raUnionRows`
- [x] 3.10 Implement `raLike` for SQL LIKE pattern matching (`%` = zero or more chars, `_` = exactly one char)
- [x] 3.11 Implement column-to-column comparison support in `raSelect`/`raSelectIndices`

## Task 4: Write property-based tests for RA_Core

- [x] 4.1 Create `tests/ra.property.test.js` with Table_Array generators using fast-check
- [x] 4.2 Write Property 1 test: select filters correctly for all comparison operators and IN ~{"pbt": true}
- [x] 4.3 Write Property 2 test: project preserves rows and extracts correct columns ~{"pbt": true}
- [x] 4.4 Write Property 3 test: join key invariant for inner, left, and right joins ~{"pbt": true}
- [x] 4.5 Write Property 4 test: union/intersection/difference set operation correctness ~{"pbt": true}
- [x] 4.6 Write Property 5 test: sort produces ordered permutation ~{"pbt": true}
- [x] 4.7 Write Property 6 test: distinct eliminates duplicates ~{"pbt": true}
- [x] 4.8 Write Property 7 test: groupBy aggregate correctness (SUM, COUNT, MIN, MAX, AVG) ~{"pbt": true}
- [x] 4.9 Write Property 8 test: compound WHERE AND/OR combines conditions correctly ~{"pbt": true}
- [x] 4.10 Write Property 9 test: LIKE pattern matching semantics ~{"pbt": true}
- [x] 4.11 Write Property 10 test: column-to-column comparison ~{"pbt": true}
- [x] 4.12 Write Property 11 test: arithmetic projection computes correctly ~{"pbt": true}
- [x] 4.13 Write Property 12 test: HAVING filters groups correctly ~{"pbt": true}
- [x] 4.14 Write Property 13 test: LIMIT restricts row count ~{"pbt": true}
- [x] 4.15 Write Property 14 test: INSERT column mapping fills correctly ~{"pbt": true}

## Task 5: Implement Query Planner (`src/QueryPlanner.gs`)

- [x] 5.1 Create `src/QueryPlanner.gs` with `planSelect` that translates a SQLParser AST into an ordered execution plan (source, joins, where, groupBy, having, project, distinct, unions, orderBy, limit)
- [x] 5.2 Implement `planUpdate` that extracts table name, WHERE conditions, and SET assignments from a simpleSqlParser AST
- [x] 5.3 Implement `planDelete` that extracts table name and WHERE conditions from a simpleSqlParser AST
- [x] 5.4 Implement `planInsert` that extracts table name, columns, and values from a simpleSqlParser AST
- [x] 5.5 Write example-based tests in `tests/planner.test.js` covering SELECT plans with joins/where/group/order/limit, UPDATE/DELETE/INSERT plans, RANGE source, and IN subqueries

## Task 6: Rewrite Statement Executors to use Query Planner and Sheet_IO

- [x] 6.1 Rewrite `selectQuery` in `src/Select.gs` to parse with SQLParser, call `planSelect`, then execute the plan using RA_Core and Sheet_IO (remove all direct SpreadsheetApp calls and duplicated logic)
- [x] 6.2 Rewrite `insert` in `src/Insert.gs` to parse with simpleSqlParser, call `planInsert`, validate columns, and delegate to `sheetIO_writeRows`
- [x] 6.3 Rewrite `update` in `src/Update.gs` to parse with simpleSqlParser, call `planUpdate`, get matching rows via RA_Core, and delegate to `sheetIO_updateCells` (remove `updateHelp` and duplicated where/select/intersect/union functions)
- [x] 6.4 Rewrite `deleteFrom` in `src/Delete.gs` to parse with simpleSqlParser, call `planDelete`, get matching rows via RA_Core, and delegate to `sheetIO_deleteRows` (remove `deleteHelp` and duplicated where/select/intersect/union functions)
- [x] 6.5 Rewrite DDL functions in `src/Table.gs` to delegate all sheet operations to Sheet_IO functions
- [x] 6.6 Write integration tests in `tests/executors.test.js` verifying each executor delegates to Sheet_IO and RA_Core correctly

## Task 7: Update SQL_Engine entry point and error handling

- [x] 7.1 Update `src/SQL.gs` to use `formatError_` that handles both Error objects (`err.message`) and legacy string throws (`String(err)`)
- [x] 7.2 Update `showPrompt` and `appendOutputRows_` to delegate to `sheetIO_appendOutputRows` and `sheetIO_getOrCreateSqlSheet`
- [x] 7.3 Update `warning` (Clear History) to delegate sheet clearing to Sheet_IO
- [x] 7.4 Convert all `throw "string"` patterns in non-vendored files to `throw new Error("string")` preserving exact message text
- [x] 7.5 Extend `tests/sql.test.js` with tests for error formatting, backward-compatible output format, and success/error message patterns

## Task 8: Remove duplicated code and clean up

- [x] 8.1 Remove duplicated WHERE/select/intersect/union functions from `src/Select.gs` (`sWhere`, `sSelect`, `sSelectAttr`, `sIntersect`, `sUnion`, `selectLike`, `selectDistinct`, `distinctRow`, `whereHelp`)
- [x] 8.2 Remove duplicated functions from `src/Update.gs` (`uWhere`, `uSelect`, `uIntersect`, `uUnion`, `updateHelp`)
- [x] 8.3 Remove duplicated functions from `src/Delete.gs` (`dWhere`, `dSelect`, `dIntersect`, `dUnion`, `deleteHelp`)
- [x] 8.4 Remove legacy helper functions from `src/RA.gs` that are replaced by new RA_Core functions (old `select`, `project`, `union`, `intersection`, `difference`, `sorting`, `selectdistinct`, `xjoin`, `ojoin`, etc.)
- [x] 8.5 Remove `src/Where.gs` if all its functionality is absorbed into RA_Core (or keep as a thin adapter if needed for transition)
- [x] 8.6 Run all tests to verify no regressions after cleanup

## Task 9: Parser round-trip property tests

- [x] 9.1 Create `tests/parser.property.test.js` with generators for valid INSERT, UPDATE, and DELETE SQL statements
- [x] 9.2 Write Property 15 test: DML parse round-trip (parse then unparse produces semantically equivalent SQL) ~{"pbt": true}

## Task 10: Final validation and backward compatibility

- [x] 10.1 Run the full test suite (`npm test` and all property test files) and fix any failures
- [x] 10.2 Verify backward compatibility: SQL() returns same 2D array format, success messages end with " success", error messages start with "Query failed: "
- [x] 10.3 Verify `appsscript.json` scopes are unchanged (`spreadsheets.currentonly`, `script.container.ui`)
- [x] 10.4 Update `package.json` test script to run all test files
