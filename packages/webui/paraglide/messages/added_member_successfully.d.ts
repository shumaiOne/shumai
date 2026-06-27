/**
* | output |
* | --- |
* | "Added {name} successfully" |
*
* @param {Added_Member_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const added_member_successfully: ((inputs: Added_Member_SuccessfullyInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Added_Member_SuccessfullyInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Added_Member_SuccessfullyInputs = {
    name: NonNullable<unknown>;
};
