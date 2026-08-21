/**
* | output |
* | --- |
* | "{creator} mentioned you in task {task}" |
*
* @param {Notification_Mentioned_You_In_TaskInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const notification_mentioned_you_in_task: ((inputs: Notification_Mentioned_You_In_TaskInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Notification_Mentioned_You_In_TaskInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Notification_Mentioned_You_In_TaskInputs = {
    creator: NonNullable<unknown>;
    task: NonNullable<unknown>;
};
