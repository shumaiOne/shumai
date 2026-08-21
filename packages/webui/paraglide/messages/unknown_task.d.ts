/**
* | output |
* | --- |
* | "unknown task" |
*
* @param {Unknown_TaskInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const unknown_task: ((inputs?: Unknown_TaskInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Unknown_TaskInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Unknown_TaskInputs = {};
