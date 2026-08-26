/**
* | output |
* | --- |
* | "Disabled (Software)" |
*
* @param {Hardware_Acceleration_OffInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const hardware_acceleration_off: ((inputs?: Hardware_Acceleration_OffInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Hardware_Acceleration_OffInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Hardware_Acceleration_OffInputs = {};
