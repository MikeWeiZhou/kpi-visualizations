import * as moment from "moment"
import { IDataStorage } from "../datastorages/IDataStorage"
import { ISchedule } from "./ISchedule"
import { IDataInterface } from "../datainterfaces/IDataInterface"
import { TransformStream } from "../streams/TransformStream"
import { WriteStream } from "../streams/WriteStream"
import { Log } from "../Log"
const config = require("../../config/config")

/**
 * Scheduler.
 * 
 * Schedules different IDataCollectors and IDataInterfaces to run at specified intervals.
 */
export class Scheduler
{
    private _dataStorage: IDataStorage;

    /**
     * Constructor.
     * @param {IDataStorage} dataStorage to write new data
     */
    public constructor(dataStorage: IDataStorage)
    {
        this._dataStorage = dataStorage;
    }

    /**
     * Schedules a given schedule if valid.
     * @async
     * @param {ISchedule} schedule to run
     * @returns {Promise<boolean>} true if scheduled, false if not
     * @throws {Error} error if errored
     */
    public async Schedule(schedule: ISchedule): Promise<boolean>
    {
        // Ensure only valid schedules run
        var validSchedule: ISchedule|null = await this.makeValidScheduleOrNull(schedule);
        if (validSchedule)
        {
            this.runSchedule(validSchedule);
            return true;
        }

        console.log("Invalid schedule:");
        console.log(schedule);
        return false;
    }

    /**
     * Runs the given schedule and re-schedules it to run again at specified interval.
     * @param {ISchedule} schedule to run
     */
    private async runSchedule(schedule: ISchedule): Promise<void>
    {
        var validSchedule: any = await this.makeValidScheduleOrNull(schedule);
        if (!validSchedule)
        {
            console.log(`Attempt to run ${schedule.Title} failed. Invalid schedule.`);
            return;
        }

        var from: string = moment(validSchedule.DataFromDate).format(config.dateformat.console);
        var to: string = moment(validSchedule.DataToDate).format(config.dateformat.console);
        console.log(`Running schedule: ${validSchedule.Title} with date ranges between ${from} and ${to}`);

        // Run schedule
        var _this: Scheduler = this;
        var transformStream: TransformStream = new TransformStream(validSchedule.DataInterface);
        var writeStream: WriteStream = new WriteStream(this._dataStorage, validSchedule.DataInterface);

        validSchedule.DataCollector.Initialize(validSchedule.DataFromDate as Date, validSchedule.DataToDate as Date);
        validSchedule.DataCollector.GetStream()
            .on("error", (err: Error) => { transformStream.emit("error", err) })
            .pipe(transformStream)
            .on("error", (err: Error) => { writeStream.emit("error", err) })
            .pipe(writeStream)
            .on("error", (err: Error) =>
            {
                console.log(`Error running schedule ${validSchedule.Title}. Error has been logged.`);
                Log(err, `Error with pipeline while running schedule ${validSchedule.Title}`);
            })
            .on("finish", async () =>
            {
                console.log(`Finished running data collection for schedule ${validSchedule.Title}`);
                if (!await _this.updateDataToDateInDb(validSchedule))
                {
                    console.log("BUT FAILED TO update dates info in data source tracking table");
                }
            });

        // Set schedule to run again
        var _this: Scheduler = this;
        setTimeout(async () =>
        {
            var newSchedule: ISchedule =
            {
                Title: validSchedule.Title,
                DataCollector: validSchedule.DataCollector,
                DataInterface: validSchedule.DataInterface,
                RunIntervalInMinutes: validSchedule.RunIntervalInMinutes,
                DataFromDate: await _this.getLastDataToDateFromDb(validSchedule.DataInterface)
            };
            _this.runSchedule(newSchedule);
        }, schedule.RunIntervalInMinutes * 1000 * 60);
    }

    /**
     * Attempts to make a given schedule valid by adding the date ranges.
     * @async
     * @param {ISchedule} schedule to validate
     * @returns {ISchedule|null} a valid ISchedule or null
     * @throws {Error} error if errored
     */
    private async makeValidScheduleOrNull(schedule: ISchedule): Promise<ISchedule|null>
    {
        if (!(0 <= schedule.RunIntervalInMinutes && schedule.RunIntervalInMinutes <= 9999))
        {
            return null;
        }

        var lastDataToDate: any = await this.getLastDataToDateFromDb(schedule.DataInterface);
        var newSchedule: ISchedule =
        {
            Title: schedule.Title,
            DataCollector: schedule.DataCollector,
            DataInterface: schedule.DataInterface,
            RunIntervalInMinutes: schedule.RunIntervalInMinutes,
            DataFromDate: schedule.DataFromDate || lastDataToDate,
            DataToDate: schedule.DataToDate || new Date()
        };

        if ((newSchedule.DataFromDate as Date) > (newSchedule.DataToDate as Date))
        {
            return null;
        }

        // There is a gap between the last data TO_DATE and the scheduled FROM_DATE
        // new scheduled FROM_DATE must <= database's TO_DATE
        if (newSchedule.DataFromDate as Date > lastDataToDate)
        {
            return null;
        }

        return newSchedule;
    }

    /**
     * Updates database with the latest To Date from schedule.
     * @async
     * @param {ISchedule} schedule containing latest to date info
     * @returns {Promise<boolean>} true if update success, false otherwise
     */
    private async updateDataToDateInDb(schedule: ISchedule): Promise<boolean>
    {
        var results: any;
        var date: string = moment(schedule.DataToDate).format(config.dateformat.mysql);
        var query: string = `UPDATE ${config.db.tablename.data_source_tracker}
                             SET TO_DATE = '${date}'
                             WHERE TABLE_NAME = '${schedule.DataInterface.TableName}'`;
        try
        {
            results = await this._dataStorage.Query(query);
        }
        catch (err)
        {
            console.log(`Failed to update tracking information for schedule ${schedule.Title}. Error has been logged.`);
            Log(err, `Failed to update tracking information for schedule ${schedule.Title}\n\nSQL Query: ${query}`);
            return false;
        }

        // No results; table is not tracked
        if (results.affectedRows == 0)
        {
            console.log(`Table ${schedule.DataInterface.TableName} not in data source tracking table. Error has been logged.`);
            var err: Error = new Error
            (`
                Table ${schedule.DataInterface.TableName} not in data source tracking table.
                SQL Query: ${query}
            `);
            Log(err, `SQL Query: ${query}`);
            return false;
        }

        return true;
    }

    /**
     * Returns the last TO_DATE of the given IDataInterface from the database.
     * @async
     * @param {IDataInterface} dataInterface table to get latest To Date info from
     * @throws {Error} error if errored
     */
    private async getLastDataToDateFromDb(dataInterface: IDataInterface): Promise<Date>
    {
        var results: any;
        var query: string = `SELECT TO_DATE
                            FROM ${config.db.tablename.data_source_tracker}
                            WHERE TABLE_NAME = '${dataInterface.TableName}'`;
        try
        {
            results = await this._dataStorage.Query(query);
        }
        catch (err)
        {
            console.log("Failed to get TO_DATE from tracking table. Error has been logged.");
            Log(err, `Errored when calling getLastDataToDateFromDb in Scheduler\n\nSQL Query: ${query}`);
            throw err;
        }

        // No results; table is not tracked
        if (results.length == 0)
        {
            console.log(`Table ${dataInterface.TableName} not in data source tracking table. Error has been logged.`);
            var err: Error = new Error
            (`
                Table ${dataInterface.TableName} not in data source tracking table.
                Error has been logged
            `);
            Log(err, `SQL Query: ${query}`);
            throw err;
        }

        return new Date(results[0].TO_DATE);
    }
}