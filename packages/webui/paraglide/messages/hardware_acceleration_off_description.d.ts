/**
* | output |
* | --- |
* | "Uses software libx264 encoder with constant rate factor (CRF)." |
*
* @param {Hardware_Acceleration_Off_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const hardware_acceleration_off_description: ((inputs?: Hardware_Acceleration_Off_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Hardware_Acceleration_Off_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Hardware_Acceleration_Off_DescriptionInputs = {};
