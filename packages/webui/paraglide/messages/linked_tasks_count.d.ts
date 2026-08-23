/**
* | output |
* | --- |
* | "{count} tasks" |
*
* @param {Linked_Tasks_CountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const linked_tasks_count: ((inputs: Linked_Tasks_CountInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Linked_Tasks_CountInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Linked_Tasks_CountInputs = {
    count: NonNullable<unknown>;
};
