# KPI Dashboard

BCIT ISSP 2018 spring project - ***REMOVED*** CI Dashboard

1. Installation
2. Configuration Files
3. KPI Chart Logic
4. Unit Tests
5. NPM Commands
6. Directory Structure
7. Included Documentations

## 0. Prototype Update (Sat May 19, 2018 11:59 PM)

Since the last prototype:

* Refined UI and added moving average period display
* Made KPI mappers more consistent in the code and in the view
* Better in-code comments of existing KPI mappers so they can serve as templates
* Bug fixes to both front- and back-end

There has been major changes including database schema update since last prototype, run command **npm run reset-all** to drop database tables and re-setup everything.

## 1. Installation

* Clone git repository on the **prototype** branch, our latest working prototype
* Install and setup required software as described in *docs/howto_setup_and_run_dashboard.md*

## 2. Configuration Files

The "config" directory contains configuration settings for the CI Dashbaord. A restart of the server must be completed before changes will take effect. Re-compilation/re-building code is not necessary.

* **config.js** pipeline, web server, error logging, date formats
* **config.db.js** database connection, table names
* **kpi.js** KPI goals and moving average settings
* **schedules.js** data collection scheduling
* **sqlqueries.js** required for setting up and updating database

## 3. KPI Chart Logic

All the KPI charts uses a simple moving average. For example, if the moving average period is 30 days, then each data point on the chart is an average (equally weighted per day) of 29 days before and the current day.

### Missing Data

Some charts will ignore (not plot) the missing data, and some will zero out the missing data points.

* All the build time and build success rate charts **ignores** missing data
* Defects: Bug Resolution Velocity, Bug Creation Velocity, Bug Resolution-Creation Difference all **zeroes** missing data
* Defects: Days To Resolve Bugs charts **ignores** missing data
* All charts in User Stories category **zeroes** missing data

Number of previous day data required per point on the chart is calculated by Math.floor(MovingAveragePeriod/2)

## 4. Unit Tests

* Run command: *npm run test*
* ^ Builds and runs unit test on the back-end

## 5. NPM Commands
These commands are mainly for easier development and testing. **DB Note**: If database model changes, old tables must be dropped/changed first.

* **npm run reset-all** deletes db tables and re-setup everything
* **npm run setup** installs node dependencies, builds front and back-end, and setup database
* **npm run setup-front** setup front-end only
* **npm run setup-back** setup back-end only, including the database
***
* **npm run setup-db** will re-run all setup queries in config/sqlqueries.js
* **npm run reset-db** deletes all tables and re-runs *setup-db* command
***
* **npm run build** builds front and back-end
* **npm run build-front** builds front-end only
* **npm run build-back** builds back-end only
***
* **npm run start** runs the built version of dashboard
***
* **npm run react** runs the development version of front-end only
***
* **npm run test** builds the back-end and runs unit tests on the back-end

## 6. Directory Structure

* **build** Javascript compiled from Typescript. Includes unit tests.
* **config** Configuration files.
* **data** Sample data files.
* **docs** Holds all the documentation and how-to's.
* **logs** Server error logs organized by date and time.
* **react-app** React application. Front-end view server when run in development mode.
* **source** Typescript source. Includes unit tests.
* **old_demo** Old demo files. Deprecated.

## 7. Included Documentations

The folder "docs" includes these documentations:

* How To Setup And Run Dashboard
* How To Add Data Source
* How To Add KPI Chart