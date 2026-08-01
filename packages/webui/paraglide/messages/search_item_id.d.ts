/**
* | output |
* | --- |
* | "Search Item ID..." |
*
* @param {Search_Item_IdInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const search_item_id: ((inputs?: Search_Item_IdInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Search_Item_IdInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Search_Item_IdInputs = {};
