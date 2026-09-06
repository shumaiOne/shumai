/**
* | output |
* | --- |
* | "Friendly name for this model" |
*
* @param {Model_Display_Name_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const model_display_name_placeholder: ((inputs?: Model_Display_Name_PlaceholderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Model_Display_Name_PlaceholderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Model_Display_Name_PlaceholderInputs = {};
