/**
* | output |
* | --- |
* | "Item ID" |
*
* @param {Item_IdInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const item_id: ((inputs?: Item_IdInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Item_IdInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Item_IdInputs = {};
