/**
* | output |
* | --- |
* | "Enabled Models" |
*
* @param {Enabled_Media_ModelsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const enabled_media_models: ((inputs?: Enabled_Media_ModelsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Enabled_Media_ModelsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Enabled_Media_ModelsInputs = {};
