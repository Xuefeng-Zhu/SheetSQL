# Requirements Document

## Introduction

This document specifies the requirements for a thorough rebuild of the SheetSQL Google Sheets add-on SQL engine. The current implementation suffers from significant code duplication (WHERE evaluation, set operations, and row selection logic are copy-pasted across Select.gs, Delete.gs, and Update.gs), loose equality throughout, inconsistent error handling (raw string throws vs Error objects), cell-by-cell I/O instead of batched reads/writes, and a tightly coupled architecture where statement executors directly call SpreadsheetApp APIs. The rebuild modernizes the engine into a clean, layered architecture with a shared relational algebra core, a unified query planner, batched spreadsheet I/O, and proper error handling — while preserving backward compatibility for existing SQL statements and the `=SQL()` custom function.

## Glossary

- **SQL_Engine**: The top-level module that receives a SQL string, dispatches it through parsing and execution, and returns results. Exposed as the `SQL()` custom function and via the prompt UI.
- **SQL_Parser**: The vendored/generated parser modules (SQLParser.gs and SimpleSQL.gs) that convert SQL strings into AST representations. These are treated as read-only.
- **Query_Planner**: The component that receives a parsed AST and produces an execution plan composed of relational algebra operations.
- **RA_Core**: The shared relational algebra engine that implements select, project, join, union, intersection, difference, grouping, sorting, distinct, and aggregate operations on in-memory table arrays.
- **Sheet_IO**: The I/O layer responsible for reading table data from and writing results to Google Sheets, using batched range operations (getValues/setValues).
- **Table_Array**: The internal 2D array representation of a table where row 0 is the table name header and row 1 is the column header row, followed by data rows.
- **Statement_Executor**: A handler for a specific SQL statement type (SELECT, INSERT, UPDATE, DELETE, CREATE TABLE, DROP TABLE, ALTER TABLE) that uses the Query_Planner and Sheet_IO to carry out the statement.
- **Error_Reporter**: The component responsible for producing structured, user-facing error messages from internal exceptions.
- **History_Sheet**: The dedicated "SQL" sheet where query results and execution history are written.

## Requirements

### Requirement 1: Unified Relational Algebra Core

**User Story:** As a developer, I want a single shared relational algebra module, so that SELECT, UPDATE, and DELETE do not each duplicate row-filtering, set-intersection, and set-union logic.

#### Acceptance Criteria

1. THE RA_Core SHALL provide a single `select` function that filters rows from a Table_Array given an attribute name, operator, and value.
2. THE RA_Core SHALL provide a single `project` function that extracts specified columns from a Table_Array.
3. THE RA_Core SHALL provide a single `join` function that performs inner, left, and right joins between two Table_Arrays given join keys and an operator.
4. THE RA_Core SHALL provide `union`, `intersection`, and `difference` functions that combine two Table_Arrays with compatible column counts.
5. THE RA_Core SHALL provide a `sort` function that orders rows by one or more columns with ASC or DESC direction.
6. THE RA_Core SHALL provide a `distinct` function that removes duplicate rows from a Table_Array.
7. THE RA_Core SHALL provide a `groupBy` function that groups rows by specified columns and applies aggregate functions (SUM, COUNT, MIN, MAX, AVG).
8. WHEN a WHERE clause contains AND or OR logic, THE RA_Core SHALL evaluate compound conditions by recursively combining row index sets using set intersection (AND) or set union (OR).
9. THE RA_Core SHALL use strict equality (`===`) for all value comparisons unless type coercion is explicitly required for operator semantics.
10. FOR ALL valid Table_Arrays, applying `select` with a condition that matches all rows SHALL return a Table_Array with the same data rows as the input.

### Requirement 2: Layered Sheet I/O

**User Story:** As a developer, I want all spreadsheet reads and writes isolated in a single I/O layer, so that the relational algebra core and query planner remain pure and testable without SpreadsheetApp dependencies.

#### Acceptance Criteria

1. THE Sheet_IO SHALL provide a `readTable` function that reads an entire sheet by name and returns a Table_Array using a single `getDataRange().getValues()` call.
2. THE Sheet_IO SHALL provide a `writeRows` function that writes a 2D array to a target sheet using a single `setValues` call instead of multiple `appendRow` calls.
3. THE Sheet_IO SHALL provide a `readRange` function that reads the currently selected range and returns a Table_Array.
4. THE Sheet_IO SHALL provide a `deleteRows` function that removes specified row indices from a sheet in descending order to preserve correct indices.
5. THE Sheet_IO SHALL provide an `updateCells` function that writes changed cell values to a sheet using batched `setValues` calls rather than individual `setValue` calls.
6. IF a sheet name passed to `readTable` does not exist, THEN THE Sheet_IO SHALL throw an Error with the message "Invalid sheet : " followed by the sheet name.
7. IF a sheet passed to `readTable` has no rows, THEN THE Sheet_IO SHALL throw an Error with the message "Sheet should atleast have a header".

### Requirement 3: Query Planner

**User Story:** As a developer, I want a query planner that translates parsed ASTs into sequences of RA_Core operations, so that statement executors are thin dispatchers rather than monolithic functions.

#### Acceptance Criteria

1. WHEN a SELECT AST is received, THE Query_Planner SHALL produce an ordered execution plan: source read, joins, WHERE filter, GROUP BY, HAVING, projection, DISTINCT, UNION, ORDER BY, LIMIT.
2. WHEN an UPDATE AST is received, THE Query_Planner SHALL produce a plan that identifies matching rows via the RA_Core `select` function and returns the row indices and SET assignments.
3. WHEN a DELETE AST is received, THE Query_Planner SHALL produce a plan that identifies matching rows via the RA_Core `select` function and returns the row indices for deletion.
4. WHEN a SELECT query uses `RANGE` as the source, THE Query_Planner SHALL instruct Sheet_IO to read from the active selection instead of a named sheet.
5. WHEN a SELECT query contains a subquery in an IN clause, THE Query_Planner SHALL recursively plan and execute the subquery to obtain the value list.

### Requirement 4: Statement Executors

**User Story:** As a developer, I want each SQL statement type handled by a small, focused executor, so that adding or modifying statement support does not require changes across multiple large files.

#### Acceptance Criteria

1. THE Statement_Executor for SELECT SHALL delegate filtering, joining, grouping, projection, sorting, and limiting entirely to the Query_Planner and RA_Core.
2. THE Statement_Executor for INSERT SHALL validate column counts, resolve column mappings, and delegate the row write to Sheet_IO using a single batched operation.
3. THE Statement_Executor for UPDATE SHALL obtain matching row indices from the Query_Planner and delegate cell updates to Sheet_IO `updateCells`.
4. THE Statement_Executor for DELETE SHALL obtain matching row indices from the Query_Planner and delegate row removal to Sheet_IO `deleteRows`.
5. THE Statement_Executor for CREATE TABLE SHALL create a new sheet with optional column headers and bold formatting via Sheet_IO.
6. THE Statement_Executor for DROP TABLE SHALL delete the named sheet via Sheet_IO.
7. THE Statement_Executor for ALTER TABLE SHALL add or drop a column on the named sheet via Sheet_IO.
8. IF a Statement_Executor receives an AST it cannot handle, THEN THE Statement_Executor SHALL throw an Error with a descriptive message identifying the unsupported construct.

### Requirement 5: Structured Error Handling

**User Story:** As a user, I want clear, consistent error messages when my SQL query fails, so that I can understand what went wrong and fix it.

#### Acceptance Criteria

1. THE Error_Reporter SHALL wrap all internal exceptions into Error objects with a human-readable `message` property.
2. WHEN a query fails during parsing, THE SQL_Engine SHALL return a single-row result containing "Query failed: " followed by the parser error message.
3. WHEN a query fails during execution, THE SQL_Engine SHALL return a single-row result containing "Query failed: " followed by the execution error message.
4. THE SQL_Engine SHALL catch errors using `err.message` for Error objects and `String(err)` for legacy string throws from the vendored parsers.
5. IF an empty or null statement is provided, THEN THE SQL_Engine SHALL return a single-row result containing "Syntax invalid: empty statement".
6. IF a statement exceeds SQL_MAX_QUERY_LENGTH characters, THEN THE SQL_Engine SHALL return a single-row result containing "Syntax invalid: statement exceeds max length".

### Requirement 6: WHERE Clause Operators

**User Story:** As a user, I want to use comparison operators, LIKE, IN, IS NULL, and IS NOT NULL in my WHERE clauses, so that I can filter data flexibly.

#### Acceptance Criteria

1. THE RA_Core SHALL support the comparison operators `<`, `>`, `=`, `>=`, `<=` for numeric and string values.
2. WHEN the operator is `LIKE`, THE RA_Core SHALL match values using SQL LIKE semantics where `%` matches zero or more characters and `_` matches exactly one character.
3. WHEN the operator is `IN`, THE RA_Core SHALL match values against a list of literal values or the result of a subquery.
4. WHEN the operator is `IS`, THE RA_Core SHALL match rows where the attribute value is empty or blank.
5. WHEN the operator is `IS NOT`, THE RA_Core SHALL match rows where the attribute value is non-empty and non-blank.
6. WHEN comparing attribute values to attribute values (column-to-column comparison), THE RA_Core SHALL resolve both column indices and compare cell values row by row.

### Requirement 7: SELECT Capabilities

**User Story:** As a user, I want full SELECT support including joins, aggregates, grouping, ordering, limits, unions, distinct, and arithmetic expressions, so that I can query my sheet data with standard SQL.

#### Acceptance Criteria

1. THE SQL_Engine SHALL support SELECT with arithmetic expressions (`+`, `-`, `/`) in the field list that compute new column values.
2. THE SQL_Engine SHALL support aggregate functions `MAX`, `MIN`, `COUNT`, `AVG`, `SUM` in the field list.
3. THE SQL_Engine SHALL support `DISTINCT` to remove duplicate rows and `DISTINCT` on a single column.
4. THE SQL_Engine SHALL support `JOIN`, `LEFT JOIN`, and `RIGHT JOIN` with `ON` conditions.
5. THE SQL_Engine SHALL support `UNION` and `UNION ALL` to combine results of multiple SELECT queries.
6. THE SQL_Engine SHALL support `GROUP BY` with one or more columns.
7. THE SQL_Engine SHALL support `HAVING` with aggregate conditions after `GROUP BY`.
8. THE SQL_Engine SHALL support `ORDER BY` with one or more columns each with `ASC` or `DESC` direction.
9. THE SQL_Engine SHALL support `LIMIT` to restrict the number of returned rows.
10. WHEN a SELECT uses `FROM RANGE`, THE SQL_Engine SHALL read data from the currently selected spreadsheet range.
11. THE SQL_Engine SHALL support column aliasing with `AS` in the field list.

### Requirement 8: DDL and DML Statements

**User Story:** As a user, I want to create, alter, and drop tables, and insert, update, and delete rows using SQL syntax, so that I can manage my sheet data with familiar commands.

#### Acceptance Criteria

1. WHEN a `CREATE TABLE name (col1, col2, ...)` statement is executed, THE SQL_Engine SHALL create a new sheet with the given name and column headers in bold.
2. IF a `CREATE TABLE` names a table that already exists, THEN THE SQL_Engine SHALL throw an Error with the message "Table already exists: " followed by the table name.
3. WHEN a `DROP TABLE name` statement is executed, THE SQL_Engine SHALL delete the sheet with the given name.
4. IF a `DROP TABLE` names a table that does not exist, THEN THE SQL_Engine SHALL throw an Error with the message "Invalid sheet : " followed by the table name.
5. WHEN an `ALTER TABLE name ADD column` statement is executed, THE SQL_Engine SHALL append the column name to the header row of the named sheet.
6. WHEN an `ALTER TABLE name DROP column` statement is executed, THE SQL_Engine SHALL remove the column from the named sheet.
7. WHEN an `INSERT INTO table VALUES (...)` statement is executed, THE SQL_Engine SHALL append a new row with the provided values to the named sheet.
8. WHEN an `INSERT INTO table (col1, col2) VALUES (v1, v2)` statement is executed, THE SQL_Engine SHALL map values to the correct column positions and fill unspecified columns with blanks.
9. WHEN an `UPDATE table SET col=val WHERE condition` statement is executed, THE SQL_Engine SHALL modify only the cells in rows matching the WHERE condition.
10. WHEN a `DELETE FROM table WHERE condition` statement is executed, THE SQL_Engine SHALL remove only the rows matching the WHERE condition.
11. WHEN an `UPDATE` or `DELETE` has no WHERE clause, THE SQL_Engine SHALL apply the operation to all data rows.

### Requirement 9: UI and Entry Points

**User Story:** As a user, I want to run SQL from a menu prompt or a cell formula, so that I can interact with the engine in the way that suits my workflow.

#### Acceptance Criteria

1. WHEN the spreadsheet is opened, THE SQL_Engine SHALL register a menu named "SQL" with items "Show prompt" and "Clear History" using `SpreadsheetApp.getUi()`.
2. WHEN the add-on is installed, THE SQL_Engine SHALL call the `onOpen` handler to register the menu.
3. WHEN "Show prompt" is selected, THE SQL_Engine SHALL display a UI prompt, execute the entered SQL statement, and write results to the History_Sheet.
4. WHEN "Clear History" is selected, THE SQL_Engine SHALL confirm with the user before clearing the History_Sheet.
5. THE SQL_Engine SHALL expose a `SQL(statement)` custom function that can be called from a cell formula and returns query results as a 2D array.
6. THE SQL_Engine SHALL create the History_Sheet automatically if it does not exist when results need to be written.

### Requirement 10: Backward Compatibility

**User Story:** As an existing user, I want my current SQL queries to continue working after the rebuild, so that I do not need to rewrite my formulas or scripts.

#### Acceptance Criteria

1. THE SQL_Engine SHALL accept the same SQL syntax as the current implementation for all supported statement types.
2. THE SQL_Engine SHALL return results in the same 2D array format: a success row followed by data rows for SELECT, or a success row for mutation statements.
3. THE SQL_Engine SHALL preserve the success message format of the statement text followed by " success".
4. THE SQL_Engine SHALL preserve the error message format of "Query failed: " followed by the error description.
5. THE SQL_Engine SHALL maintain the `SQL` sheet as the default output destination for prompt-based queries.
6. THE SQL_Engine SHALL preserve the `RANGE` keyword in FROM clauses to query the active selection.

### Requirement 11: Code Quality and Platform Constraints

**User Story:** As a developer, I want the rebuilt code to follow Apps Script best practices and project coding standards, so that the codebase is maintainable and performs well.

#### Acceptance Criteria

1. THE SQL_Engine SHALL use V8-compatible JavaScript syntax supported by Google Apps Script.
2. THE SQL_Engine SHALL use strict equality (`===`, `!==`) for all comparisons unless type coercion is explicitly required.
3. THE SQL_Engine SHALL keep functions small and single-purpose.
4. THE SQL_Engine SHALL avoid introducing external runtime dependencies.
5. THE SQL_Engine SHALL use batched range writes (`setValues`) instead of multiple `appendRow` or `setValue` calls for writing output.
6. THE SQL_Engine SHALL use batched range reads (`getValues`) instead of cell-by-cell `getValue` calls for reading table data.
7. THE SQL_Engine SHALL maintain minimal OAuth scopes as declared in `appsscript.json`: `spreadsheets.currentonly` and `script.container.ui`.
8. THE SQL_Engine SHALL treat parser files (SQLParser.gs, SimpleSQL.gs) as vendored and avoid modifying them.

### Requirement 12: SQL Parser Round-Trip Integrity

**User Story:** As a developer, I want to verify that the vendored SimpleSQL parser can round-trip SQL statements through parse and unparse, so that I can trust the AST representation is faithful.

#### Acceptance Criteria

1. FOR ALL valid INSERT statements, parsing with `simpleSqlParser.sql2ast` then unparsing with `simpleSqlParser.ast2sql` SHALL produce a semantically equivalent SQL string.
2. FOR ALL valid UPDATE statements with WHERE clauses, parsing then unparsing SHALL produce a semantically equivalent SQL string.
3. FOR ALL valid DELETE statements with WHERE clauses, parsing then unparsing SHALL produce a semantically equivalent SQL string.
4. THE SQL_Engine SHALL not modify the vendored parser modules to achieve round-trip integrity; the tests validate existing parser behavior.
