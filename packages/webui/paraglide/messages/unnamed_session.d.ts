/**
* | output |
* | --- |
* | "Unnamed Session" |
*
* @param {Unnamed_SessionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const unnamed_session: ((inputs?: Unnamed_SessionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Unnamed_SessionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Unnamed_SessionInputs = {};
