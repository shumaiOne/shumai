/**
* | output |
* | --- |
* | "Yesterday {time}" |
*
* @param {Yesterday_With_TimeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const yesterday_with_time: ((inputs: Yesterday_With_TimeInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Yesterday_With_TimeInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Yesterday_With_TimeInputs = {
    time: NonNullable<unknown>;
};
