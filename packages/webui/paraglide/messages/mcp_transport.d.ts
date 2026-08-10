/**
* | output |
* | --- |
* | "Transport Protocol" |
*
* @param {Mcp_TransportInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_transport: ((inputs?: Mcp_TransportInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_TransportInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_TransportInputs = {};
