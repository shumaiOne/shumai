/**
* | output |
* | --- |
* | "{count} tasks" |
*
* @param {Goal_Task_CountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const goal_task_count: ((inputs: Goal_Task_CountInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Goal_Task_CountInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Goal_Task_CountInputs = {
    count: NonNullable<unknown>;
};
