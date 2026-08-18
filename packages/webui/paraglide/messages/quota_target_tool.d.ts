/**
* | output |
* | --- |
* | "Tool: {value}" |
*
* @param {Quota_Target_ToolInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_target_tool: ((inputs: Quota_Target_ToolInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Target_ToolInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Target_ToolInputs = {
    value: NonNullable<unknown>;
};
