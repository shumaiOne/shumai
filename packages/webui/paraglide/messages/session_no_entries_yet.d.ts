/**
* | output |
* | --- |
* | "The session might have been initialized but has not produced any entries yet." |
*
* @param {Session_No_Entries_YetInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const session_no_entries_yet: ((inputs?: Session_No_Entries_YetInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Session_No_Entries_YetInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Session_No_Entries_YetInputs = {};
