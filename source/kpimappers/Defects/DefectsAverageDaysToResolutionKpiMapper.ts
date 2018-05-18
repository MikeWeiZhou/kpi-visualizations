import { KpiMapper } from "../KpiMapper"
import { IKpiState } from "../IKpiState"
const kpigoals = require("../../../config/kpigoals")
const config = require("../../../config/config")
import * as moment from "moment"

/**
 * DefectsAverageDaysToResolution.
 * 
 * Defects - Average Days to resolution for bugs completed
 */
export class DefectsAverageDaysToResolutionKpiMapper extends KpiMapper
{
    public readonly Title: string = "Average Days to Resolution";
    
    private _annualTarget: number = kpigoals.bugs_resolution_time_major.target;
    private _annualStretchGoal: number = kpigoals.bugs_resolution_time_major.stretch;

    private _from: string;
    private _to: string;
    
    private _tablename: string = config.db.tablename.bug_resolution_dates;

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
        return [`
        SELECT cast(T1.RESOLVED as date) AS Date,
        AVG(T2.Days) AS Average
        FROM 
        (
            SELECT 
            cast(resolution_date as date) AS RESOLVED,
            avg(datediff(cast(resolution_date as date),cast(creation_date as date))) as Days
            FROM ${this._tablename}
            WHERE RESOLUTION_DATE IS NOT NULL
            and priority = 'Major'
            and cast(resolution_date as date) between '${from}' AND '${to}'
            group by resolved
        ) as T1
        LEFT JOIN 
        (
            SELECT 
            cast(resolution_date as date) AS RESOLVED,
            avg(datediff(cast(resolution_date as date),cast(creation_date as date))) as Days
            FROM ${this._tablename}
            WHERE RESOLUTION_DATE IS NOT NULL
            and priority = 'Major'
            and cast(resolution_date as date) between '${from}' AND '${to}'
            group by resolved
        ) as T2
          ON T2.RESOLVED BETWEEN
             DATE_ADD(T1.RESOLVED, INTERVAL -6 DAY) AND T1.RESOLVED
        WHERE T1.RESOLVED BETWEEN '${from}' AND '${to}'
        GROUP BY Date
        ORDER BY CAST(T1.RESOLVED AS DATE) ASC
    `,
    `
        SELECT cast(T1.RESOLVED as date) AS Date,
            AVG(T2.Days) AS Average
            FROM 
            (
                SELECT 
                cast(resolution_date as date) AS RESOLVED,
                avg(datediff(cast(resolution_date as date),cast(creation_date as date))) as Days
                FROM ${this._tablename}
                WHERE RESOLUTION_DATE IS NOT NULL
                and priority = 'Critical'
                and cast(resolution_date as date)between '${from}' AND '${to}'
                group by resolved
            ) as T1
            LEFT JOIN 
            (
                SELECT 
                cast(resolution_date as date) AS RESOLVED,
                avg(datediff(cast(resolution_date as date),cast(creation_date as date))) as Days
                FROM ${this._tablename}
                WHERE RESOLUTION_DATE IS NOT NULL
                and priority = 'Critical'
                and cast(resolution_date as date) between '${from}' AND '${to}'
                group by resolved
            ) as T2
            ON T2.RESOLVED BETWEEN
                DATE_ADD(T1.RESOLVED, INTERVAL -6 DAY) AND T1.RESOLVED
            WHERE T1.RESOLVED BETWEEN '${from}' AND '${to}'
            GROUP BY Date
            ORDER BY CAST(T1.RESOLVED AS DATE) ASC
    `];
    }

    /**
     * Returns a KpiState given multiple JSON arrays containing queried data.
     * @param {Array<any>[]} jsonArrays One or more JSON array results (potentially empty arrays)
     * @returns {IKpiState|null} IKpiState object or null when insufficient data
     * @override
     */
    protected mapToKpiStateOrNull(jsonArrays: Array<any>[]): IKpiState|null
    {
        var dateLowerBound: string = moment(this._from).format(config.dateformat.charts);
        var dateUpperBound: string = moment(this._to).format(config.dateformat.charts);

        var maxYVal:number = jsonArrays[0][0].Average;
        var minYVal:number = 0;

        var values: Array<any>[] =[];
        var labels: Array<any>[]= [];
        var values2: Array<any>[] =[];
        var labels2: Array<any>[]= [];

        jsonArrays[0].forEach(function(a){
            values.push(a.Average);
            labels.push(a.Date);
            if(maxYVal < a.Average) {
                maxYVal = a.Average
            }
            if(minYVal < a.Average) {
                minYVal = a.Average
            }
        });
        jsonArrays[1].forEach(function(a){
            values2.push(a.Average);
            labels2.push(a.Date);
            if(maxYVal < a.Average) {
                maxYVal = a.Average
            }
            if(minYVal < a.Average) {
                minYVal = a.Average
            }
        });

       //console.log(labels);
       // console.log(labels2);

        return {
            data: [{
                x: labels,
                y: values,
                name: "Critical",
                type: "scatter",
                mode: "lines",
                line: {
                    "shape": "spline",
                    "smoothing": 1.3
                }
            }
            ,
            {
                x: labels2,
                y: values2,
                name: "Major",
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
                xaxis:{
                    title: "Date",
                    fixedrange: true//,
                    //range: [dateLowerBound, dateUpperBound]
                },
                yaxis: {
                    title: "Day",
                    fixedrange: true//,
                    //range: [minYVal-.5, maxYVal + .5]
                },
                shapes: [
                    {
                        type: 'line',
                        xref: 'paper',
                        x0: 0,
                        y0: this._annualTarget,
                        x1: 1,
                        y1: this._annualTarget,
                        line: {
                            color: 'rgb(0, 255, 0)',
                            width: 4,
                            dash:'dot'
                        }
                    },
                    {
                        type: 'line',
                        xref: 'paper',
                        x0: 0,
                        y0: this._annualStretchGoal,
                        x1: 1,
                        y1: this._annualStretchGoal,
                        line: {
                            color: 'gold',
                            width: 4,
                            dash:'dot'
                        }
                    }
                ]
            },
            frames: [],
            config: {}
        };
    }
}