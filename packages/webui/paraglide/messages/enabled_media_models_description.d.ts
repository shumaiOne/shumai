/**
* | output |
* | --- |
* | "Models enabled for the generate_image and generate_video tools. The first model of each type serves as default." |
*
* @param {Enabled_Media_Models_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const enabled_media_models_description: ((inputs?: Enabled_Media_Models_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Enabled_Media_Models_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Enabled_Media_Models_DescriptionInputs = {};
