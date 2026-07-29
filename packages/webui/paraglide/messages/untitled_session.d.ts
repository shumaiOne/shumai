/**
* | output |
* | --- |
* | "Untitled Session" |
*
* @param {Untitled_SessionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const untitled_session: ((inputs?: Untitled_SessionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Untitled_SessionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Untitled_SessionInputs = {};
