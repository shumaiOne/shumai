/**
* | output |
* | --- |
* | "MCP server test failed" |
*
* @param {Mcp_Test_FailedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_test_failed: ((inputs?: Mcp_Test_FailedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Test_FailedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Test_FailedInputs = {};
