/**
* | output |
* | --- |
* | "Test Connection" |
*
* @param {Mcp_Test_ConnectionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_test_connection: ((inputs?: Mcp_Test_ConnectionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Test_ConnectionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Test_ConnectionInputs = {};
