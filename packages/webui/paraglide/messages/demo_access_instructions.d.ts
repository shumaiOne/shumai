/**
* | output |
* | --- |
* | "Use \"foo@bar.com\" as the email and \"foo\" as the password to login (this demo account is read-only)." |
*
* @param {Demo_Access_InstructionsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const demo_access_instructions: ((inputs?: Demo_Access_InstructionsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Demo_Access_InstructionsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Demo_Access_InstructionsInputs = {};
