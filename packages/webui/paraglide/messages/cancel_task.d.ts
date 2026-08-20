/**
* | output |
* | --- |
* | "Cancel Task" |
*
* @param {Cancel_TaskInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const cancel_task: ((inputs?: Cancel_TaskInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Cancel_TaskInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Cancel_TaskInputs = {};
