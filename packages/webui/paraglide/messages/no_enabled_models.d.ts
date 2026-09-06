/**
* | output |
* | --- |
* | "No media generation models enabled yet. Add at least one image or video model to enable the generation tools." |
*
* @param {No_Enabled_ModelsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_enabled_models: ((inputs?: No_Enabled_ModelsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Enabled_ModelsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Enabled_ModelsInputs = {};
