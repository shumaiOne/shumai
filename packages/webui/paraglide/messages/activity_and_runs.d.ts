/**
* | output |
* | --- |
* | "Activity & Runs" |
*
* @param {Activity_And_RunsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const activity_and_runs: ((inputs?: Activity_And_RunsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Activity_And_RunsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Activity_And_RunsInputs = {};
