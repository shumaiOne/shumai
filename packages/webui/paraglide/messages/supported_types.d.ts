/**
* | output |
* | --- |
* | "Supported" |
*
* @param {Supported_TypesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const supported_types: ((inputs?: Supported_TypesInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Supported_TypesInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Supported_TypesInputs = {};
