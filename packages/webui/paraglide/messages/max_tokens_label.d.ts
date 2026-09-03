/**
* | output |
* | --- |
* | "max {count}" |
*
* @param {Max_Tokens_LabelInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const max_tokens_label: ((inputs: Max_Tokens_LabelInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Max_Tokens_LabelInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Max_Tokens_LabelInputs = {
    count: NonNullable<unknown>;
};
