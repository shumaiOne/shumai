/**
* | output |
* | --- |
* | "Network Sandbox" |
*
* @param {Network_SandboxInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const network_sandbox: ((inputs?: Network_SandboxInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Network_SandboxInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Network_SandboxInputs = {};
