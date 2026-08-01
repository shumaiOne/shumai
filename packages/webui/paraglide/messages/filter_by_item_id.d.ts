/**
* | output |
* | --- |
* | "Filter by Item ID" |
*
* @param {Filter_By_Item_IdInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const filter_by_item_id: ((inputs?: Filter_By_Item_IdInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Filter_By_Item_IdInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Filter_By_Item_IdInputs = {};
