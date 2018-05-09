const JsonDataCollector = require("../build/datacollectors/JsonDataCollector");
const QaBuildsAndRunsFromBambooDataInterface = require("../build/datainterfaces/QaBuildsAndRunsFromBambooDataInterface");
const BugResolutionDatesDataInterface = require("../build/datainterfaces/BugResolutionDatesDataInterface");
const ResolvedStoryPointsDataInterface = require("../build/datainterfaces/ResolvedStoryPointsDataInterface");
const config = require("./config")

var schedules = {};

/*************
 * S E T U P *
 *************/

// Format of schedules should match interface in source/scheduler/ISchedule.ts
schedules =
[
    {
        Title: "QA Builds and Runs from Bamboo",
        DataCollector: new JsonDataCollector.JsonDataCollector("./data/qa_builds_and_runs_from_bamboo.json"),
        DataInterface: new QaBuildsAndRunsFromBambooDataInterface.QaBuildsAndRunsFromBambooDataInterface(),
        RunIntervalInMinutes: 999
    },
    {
        Title: "Bug Resolution Dates",
        DataCollector: new JsonDataCollector.JsonDataCollector("./data/bug_data.json"),
        DataInterface: new BugResolutionDatesDataInterface.BugResolutionDatesDataInterface(),
        RunIntervalInMinutes: 999
    },
    {
        Title: "Resolved Story Points",
        DataCollector: new JsonDataCollector.JsonDataCollector("./data/story_data.json"),
        DataInterface: new ResolvedStoryPointsDataInterface.ResolvedStoryPointsDataInterface(),
        RunIntervalInMinutes: 999
    }
];

module.exports = schedules;