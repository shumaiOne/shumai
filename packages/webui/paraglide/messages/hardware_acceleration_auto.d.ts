/**
* | output |
* | --- |
* | "Auto Detect" |
*
* @param {Hardware_Acceleration_AutoInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const hardware_acceleration_auto: ((inputs?: Hardware_Acceleration_AutoInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Hardware_Acceleration_AutoInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Hardware_Acceleration_AutoInputs = {};
