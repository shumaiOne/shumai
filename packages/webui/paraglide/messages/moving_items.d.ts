/**
* | output |
* | --- |
* | "Moving {count} item(s)" |
*
* @param {Moving_ItemsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const moving_items: ((inputs: Moving_ItemsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Moving_ItemsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Moving_ItemsInputs = {
    count: NonNullable<unknown>;
};
