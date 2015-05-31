The link to the [demo](https://docs.google.com/spreadsheet/ccc?key=0AlMMHFOg-bRZdHlJSlV5VXpfbElZSHY2c05iem5mR3c&usp=sharing)

## Overview
SheetSQL builds a SQL engine into Google sheet by storing and retrieving data directly in Google Sheet.

##Usage
There are two ways to run SQL statement:

1. Click "SQL" in the menu and click "Show prompt"
2. Type `=SQL(statement)` directly in a cell.

A long SQL statement example can be 
```SELECT DISTINCT a+1, b, MIN(c) FROM table1 JOIN table 2 WHERE (a = 1 AND b  LIKE  '%dads') OR c IN  (SELECT c FROM table4) GROUP BY a,b HAVING AVG(c) > 5 AND MAX(c) < 10 ORDER BY a DESC LIMIT 20  UNION SELECT a+1, b, MIN(c) FROM table 3 GROUP BY a,b```  
I also have provided examples in the sheet for legible statement. 

##Feature
SheetSQL currently supports following SQL statements

1. CREATE TABLE
2. DROP TABLE
3. ALTER TABLE
4. INSERT INTO
5. DELETE FROM
6. UPDATE
7. SELECT

In the **Select**, it support 

1. Math operation, like -,+,/. 
2. Aggregate Function, like MAX, MIN, COUNT, AVG, SUM
3. DISTINCT *, DISTINCT column 
4. FROM 
5. JOIN, LEFT JOIN, RIGHT JOIN, ON
6. UNION
7. WHERE, AND, OR, IN, LIKE, IS NULL, IS NOT NULL
8. GROUP BY
9. HAVING
10. ORDER BY
11. LIMIT

I add an advanced feature **fast select**. The way to use it is to select a range in a table want to query. Run SQL query by using key word RANGE as the source for FROM. And the query will perform on the range you selected.

##Thanks
*  [simpleSqlParser](https://github.com/dsferruzza/simpleSqlParser) to parse Insert, Update, Delete Statement
*  [sql-parser](https://github.com/forward/sql-parser) to parse Select statement


##Licence
MIT


