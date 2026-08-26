/**
* | output |
* | --- |
* | "Hardware Acceleration" |
*
* @param {Hardware_AccelerationInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const hardware_acceleration: ((inputs?: Hardware_AccelerationInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Hardware_AccelerationInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Hardware_AccelerationInputs = {};
