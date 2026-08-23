/**
* | output |
* | --- |
* | "Request Changes" |
*
* @param {Request_ChangesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const request_changes: ((inputs?: Request_ChangesInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Request_ChangesInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Request_ChangesInputs = {};
