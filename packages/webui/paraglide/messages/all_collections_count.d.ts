/**
* | output |
* | --- |
* | "All Collections ({count})" |
*
* @param {All_Collections_CountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const all_collections_count: ((inputs: All_Collections_CountInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<All_Collections_CountInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type All_Collections_CountInputs = {
    count: NonNullable<unknown>;
};
