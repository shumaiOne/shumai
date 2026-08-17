/**
* | output |
* | --- |
* | "Refreshes in {time}" |
*
* @param {Quota_Refreshes_InInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_refreshes_in: ((inputs: Quota_Refreshes_InInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Refreshes_InInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Refreshes_InInputs = {
    time: NonNullable<unknown>;
};
