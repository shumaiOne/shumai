/**
* | output |
* | --- |
* | "Domain already exists" |
*
* @param {Domain_Already_ExistsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const domain_already_exists: ((inputs?: Domain_Already_ExistsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Domain_Already_ExistsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Domain_Already_ExistsInputs = {};
