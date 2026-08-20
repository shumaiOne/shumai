/**
* | output |
* | --- |
* | "No tasks in this column" |
*
* @param {No_Tasks_In_ColumnInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_tasks_in_column: ((inputs?: No_Tasks_In_ColumnInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Tasks_In_ColumnInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Tasks_In_ColumnInputs = {};
