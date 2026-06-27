/**
* | output |
* | --- |
* | "Renamed to" |
*
* @param {Renamed_ToInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const renamed_to: ((inputs?: Renamed_ToInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Renamed_ToInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Renamed_ToInputs = {};
