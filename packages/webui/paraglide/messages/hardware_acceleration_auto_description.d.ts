/**
* | output |
* | --- |
* | "Automatically probes and uses GPU/Hardware acceleration (NVENC, QSV, AMF, VideoToolbox)." |
*
* @param {Hardware_Acceleration_Auto_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const hardware_acceleration_auto_description: ((inputs?: Hardware_Acceleration_Auto_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Hardware_Acceleration_Auto_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Hardware_Acceleration_Auto_DescriptionInputs = {};
