/**
* | output |
* | --- |
* | "Complete Task" |
*
* @param {Complete_TaskInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const complete_task: ((inputs?: Complete_TaskInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Complete_TaskInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Complete_TaskInputs = {};
