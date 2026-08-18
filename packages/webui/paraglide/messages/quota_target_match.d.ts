/**
* | output |
* | --- |
* | "Match: {value}" |
*
* @param {Quota_Target_MatchInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_target_match: ((inputs: Quota_Target_MatchInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Target_MatchInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Target_MatchInputs = {
    value: NonNullable<unknown>;
};
