/**
* | output |
* | --- |
* | "Oldest → Newest" |
*
* @param {Sort_Oldest_To_NewestInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sort_oldest_to_newest: ((inputs?: Sort_Oldest_To_NewestInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Sort_Oldest_To_NewestInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Sort_Oldest_To_NewestInputs = {};
