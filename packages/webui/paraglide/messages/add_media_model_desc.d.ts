/**
* | output |
* | --- |
* | "Select the media generation type, provider, and model to enable." |
*
* @param {Add_Media_Model_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_media_model_desc: ((inputs?: Add_Media_Model_DescInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Add_Media_Model_DescInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Add_Media_Model_DescInputs = {};
