/**
* | output |
* | --- |
* | "Active Window" |
*
* @param {Quota_Active_WindowInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_active_window: ((inputs?: Quota_Active_WindowInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Active_WindowInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Active_WindowInputs = {};
