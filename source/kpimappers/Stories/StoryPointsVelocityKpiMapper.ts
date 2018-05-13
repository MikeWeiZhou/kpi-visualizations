import * as moment from "moment"
import { KpiMapper } from "../KpiMapper"
import { IKpiState } from "../IKpiState"
const kpigoals = require("../../../config/kpigoals")
const config = require("../../../config/config")

/**
 * StoryPointsVelocityKpiMapper.
 * 
 * Days with no data will be treated as zero.
 */
export class StoryPointsVelocityKpiMapper extends KpiMapper
{
    public readonly Title: string = "Story Points Velocity";

    // Minimum number of data points preferred in chart
    // # of data points on actual chart will always be between date range and 2x+1
    private readonly _preferredMinNumOfDataPoints: number = 15;

    private _annualTarget: number = kpigoals.story_points_velocity.target_annual;
    private _annualStretchGoal: number = kpigoals.story_points_velocity.stretch_annual;

    private _minNumOfDataPoints: number;
    private _daysInOneDataPoint: number;
    private _expectedNumDataPoints: number;
    private _from: string;
    private _to: string;

    /**
     * Returns an array of SQL query strings given a date range.
     * @param {string} from date
     * @param {string} to date
     * @param {number} dateRange between from and to dates
     * @returns {string[]} an array of one or more SQL query string
     * @override
     */
    protected getQueryStrings(from: string, to: string, dateRange: number): string[]
    {
        this._from = from;
        this._to = to;

        // Calculate number of days per data point
        this._minNumOfDataPoints = Math.min(dateRange, this._preferredMinNumOfDataPoints);
        this._daysInOneDataPoint = Math.ceil(dateRange / this._minNumOfDataPoints);

        // If date range is not fully divisible by the number of days in one data point,
        // more days need to be added to ensure each data point has exactly this._daysInOneDataPoint days.
        // Also, 1 - 2 data points are added to ensure the starting date plotted <= from date
        var numDaysToAdd = 2 * this._daysInOneDataPoint - (dateRange % this._daysInOneDataPoint);
        var dataFrom = moment(from).subtract(numDaysToAdd, "days").format(config.dateformat.mysql);

        // Calculate number of expected data points assumming no missing/empty data in between from-to date
        this._expectedNumDataPoints = (moment(this._to).diff(dataFrom, "days") + 1) / this._daysInOneDataPoint;

        return [
            `
                SELECT SUM(STORY_POINTS) AS 'POINTS'
                      ,FLOOR(DATEDIFF('${to}', RESOLUTION_DATE) / ${this._daysInOneDataPoint}) AS 'PERIOD'
                FROM ${config.db.tablename.resolved_story_points}
                WHERE RESOLUTION_DATE BETWEEN '${dataFrom}' AND '${to}'
                GROUP BY PERIOD
                ORDER BY PERIOD DESC;
            `
        ];
        /*
        Bigger period values = older
        +--------+--------+
        | POINTS | PERIOD |
        +--------+--------+
        |     7  |      3 |
        |     4  |      2 |
        |     9  |      1 |
        +--------+--------+*/
    }

    /**
     * Returns a KpiState given multiple JSON arrays containing queried data.
     * @param {Array<any>[]} jsonArrays One or more JSON array results (potentially empty arrays)
     * @returns {IKpiState|null} IKpiState object or null when insufficient data
     * @override
     */
    protected mapToKpiStateOrNull(jsonArrays: Array<any>[]): IKpiState|null
    {
        // Invalid; Requires at least 2 data points
        if (jsonArrays[0].length < 2)
        {
            return null;
        }

        var storyPointsXY: any = this.getStoryPointsXY(jsonArrays[0], this._expectedNumDataPoints);
        var dateLowerBound: string = moment(this._from).format(config.dateformat.charts);
        var dateUpperBound: string = moment(this._to).format(config.dateformat.charts);

        // Return Plotly.js consumable
        return {
            data: [
                // Story Points Data Set
                {
                    x: storyPointsXY.x,
                    y: storyPointsXY.y,
                    name: "Story Points Velocity",
                    type: "scatter",
                    mode: "lines",
                    line: {
                        "shape": "spline",
                        "smoothing": 1.3
                    }
                }
            ],
            layout: {
                title: this.Title,
                xaxis: {
                    title: "Date",
                    fixedrange: true,
                    range: [dateLowerBound, dateUpperBound]
                },
                yaxis: {
                    title: "Average story points / day",
                    fixedrange: true,
                    rangemode: "nonnegative"
                },
                shapes: [
                    // Annual Target Line
                    {
                        type: 'line',
                        xref: 'paper',
                        x0: 0,
                        x1: 1,
                        y0: this._annualTarget/365,
                        y1: this._annualTarget/365,
                        line: {
                            color: 'rgb(0, 255, 0)',
                            width: 4,
                            dash:'dot'
                        }
                    },
                    // Annual Stretch Goal Line
                    {
                        type: 'line',
                        xref: 'paper',
                        x0: 0,
                        x1: 1,
                        y0: this._annualStretchGoal/365,
                        y1: this._annualStretchGoal/365,
                        line: {
                            color: 'gold',
                            width: 4,
                            dash:'dot'
                        }
                    }
                ]
            },
            frames: [],
            config: {
                displayModeBar: false
            }
        };
    }

    /**
     * Returns Story Points' XY values.
     * Missing data points: zeroed.
     * @param {Array<any>} data
     * @param {number} expectedDataPoints
     * @returns {object} XY values
     */
    private getStoryPointsXY(data: Array<any>, expectedDataPoints: number) : object
    {
        var x: Array<any> = [];
        var y: Array<any> = [];

        var i: number = 0;
        var period: number = expectedDataPoints;
        while (i < data.length)
        {
            let date: string = moment(this._to)
                .subtract(period * this._daysInOneDataPoint, "days")
                .format(config.dateformat.charts);
            let point: number = (data[i].PERIOD == period)
                ? data[i++].POINTS / this._daysInOneDataPoint
                : 0; // ZEROES missing data point
            x.push(date);
            y.push(point);
            --period;
        }

        return {
            x: x,
            y: y
        };
    }
}