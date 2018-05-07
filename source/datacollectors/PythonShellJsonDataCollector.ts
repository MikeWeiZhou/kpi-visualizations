import * as moment from "moment"
import { Readable, Writable, Stream } from "stream"
import { IDataCollector } from "./IDataCollector"
const PythonShell = require("python-shell");
const json = require("JSONStream");
const config = require("../../config/config");

/**
 * PythonShellJsonDataCollector.
 * 
 * Returns a stream to stdout of a specified python script.
 */
export class PythonShellJsonDataCollector implements IDataCollector
{
    private _filepath: string;
    private _jsonParsePath: string;
    private _isInitialized: boolean;
    private _readStream: Readable;
    private _pythonShell: any;

    /**
     * Constructor.
     * @param {string} filepath to python script to be executed
     * @param {string} jsonParsePath JSONPath to parse
     */
    public constructor(filepath: string, jsonParsePath: string)
    {
        this._filepath = filepath;
        this._jsonParsePath = jsonParsePath;
        this._isInitialized = false;
    }

    /**
     * Launch python script, send requested date range, and add event listeners.
     * Must be able to handle multiple Initialize calls without disposing IDataCollector.
     * @param {Date} from
     * @param {Date} to
     * @override
     */
    public Initialize(from: Date, to: Date): void
    {
        var fromDate: string = moment.utc(from).format(config.dateformat.python);
        var toDate: string = moment.utc(to).format(config.dateformat.python);

        this._readStream = new Readable({objectMode: true});
        this._readStream._read = () => {};
        this._pythonShell = new PythonShell(this._filepath, {mode: "text"});

        // listen for data and push to stream when available
        this._pythonShell.stdout.on("data", (data: any) =>
        {
            this._readStream.push(data);
        });

        // send requested date ranges
        this._pythonShell.send(fromDate).send(toDate);

        // executes when python script ends
        var __this: PythonShellJsonDataCollector = this;
        this._pythonShell.end((err: Error, code: number, signal: any) =>
        {
            // exit code = 0 means executed successfully
            //           = 1 means program exception, e.g. division by zero
            // can have python script call sys.exit(5) to give error code of 5
            if (err)
            {
                __this._readStream.emit("error", err);
                return;
            }

            // signal end of stream
            __this._readStream.push(null);
        });

        this._isInitialized = true;
    }

    /**
     * Returns a Stream to the python script output.
     * @returns {Stream} stream to the python script output
     * @throws {Error} if PythonShellJsonDataCollector not initialized
     * @override
     */
    public GetStream(): Stream
    {
        if (!this._isInitialized)
        {
            throw new Error("PythonShellJsonDataCollector NOT_INITIALIZED_ERR");
        }

        var _jsonStream: Writable = json.parse(this._jsonParsePath);
        return this._readStream
            // forward _readStream's error to _jsonStream
            // giving downstream access to errors
            .on("error", (err: Error) => { _jsonStream.emit("error", err) })
            .pipe(_jsonStream);
    }

    /**
     * Not used.
     * @override
     */
    public Dispose(): void
    {
    }
}