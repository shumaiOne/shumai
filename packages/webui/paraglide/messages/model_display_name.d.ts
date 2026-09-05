/**
* | output |
* | --- |
* | "Display Name (Optional)" |
*
* @param {Model_Display_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const model_display_name: ((inputs?: Model_Display_NameInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Model_Display_NameInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Model_Display_NameInputs = {};
