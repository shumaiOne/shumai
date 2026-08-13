/**
* | output |
* | --- |
* | "Add options: {name}" |
*
* @param {Add_Option_With_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_option_with_name: ((inputs: Add_Option_With_NameInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Add_Option_With_NameInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Add_Option_With_NameInputs = {
    name: NonNullable<unknown>;
};
