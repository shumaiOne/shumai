/**
* | output |
* | --- |
* | "e.g., gpt-4o, claude-3-5-sonnet-20241022" |
*
* @param {Model_Id_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const model_id_placeholder: ((inputs?: Model_Id_PlaceholderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Model_Id_PlaceholderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Model_Id_PlaceholderInputs = {};
