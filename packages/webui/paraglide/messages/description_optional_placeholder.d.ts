/**
* | output |
* | --- |
* | "Description (Optional, used for AI autofill)" |
*
* @param {Description_Optional_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const description_optional_placeholder: ((inputs?: Description_Optional_PlaceholderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Description_Optional_PlaceholderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Description_Optional_PlaceholderInputs = {};
