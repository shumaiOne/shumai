/**
* | output |
* | --- |
* | "Session Entries" |
*
* @param {Session_EntriesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const session_entries: ((inputs?: Session_EntriesInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Session_EntriesInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Session_EntriesInputs = {};
