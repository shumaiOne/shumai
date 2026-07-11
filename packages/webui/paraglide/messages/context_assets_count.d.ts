/**
* | output |
* | --- |
* | "Context Assets ({count})" |
*
* @param {Context_Assets_CountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const context_assets_count: ((inputs: Context_Assets_CountInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Context_Assets_CountInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Context_Assets_CountInputs = {
    count: NonNullable<unknown>;
};
