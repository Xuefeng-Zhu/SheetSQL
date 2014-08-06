The link to the project is [demo](https://docs.google.com/spreadsheet/ccc?key=0AlMMHFOg-bRZdHlJSlV5VXpfbElZSHY2c05iem5mR3c&usp=sharing)

## Overview
The SQL implementation is based on Google sheet by storing data directly on Google Sheet.

##Feature
It surpports following SQL statement

1. CREATE TABLE
2. DROP TABLE
3. ALTER TABLE
4. INSERT INTO
5. DELETE FROM
6. UPDATE statements.
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

I add an advanced feature called fast select. The way to use it is to select the range of table want to query. Run SQL query by using key word RANGE for FROM source. And the query will perform on the range you selected. The reason I want to delevep this advanced feature is prodive a convient way to run query on the result returned by previous SQL Query.

##Example
A long example can be 
```SELECT DISTINCT a+1, b, MIN(c) FROM table1 JOIN table 2 WHERE (a = 1 AND b  LIKE  '%dads') OR c IN  (SELECT c FROM table4) GROUP BY a,b HAVING AVG(c) > 5 AND MAX(c) < 10 ORDER BY a DESC LIMIT 20  UNION SELECT a+1, b, MIN(c) FROM table 3 GROUP BY a,b```  
I also have provided examples in the sheet for legible statement. 

The way to run the SQL statement is to click SQL in the menu OR Type =SQL() directly in cell.

##Thanks
I use two github open source projects for the parser. 
https://github.com/dsferruzza/simpleSqlParser to parse Insert, Update, Delete Statement
https://github.com/forward/sql-parser to parse Select statement
I also use code from homework2, but I modify and rewrite most of them.

##Licence
MIT


