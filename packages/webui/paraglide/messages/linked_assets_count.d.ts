/**
* | output |
* | --- |
* | "{count} assets" |
*
* @param {Linked_Assets_CountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const linked_assets_count: ((inputs: Linked_Assets_CountInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Linked_Assets_CountInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Linked_Assets_CountInputs = {
    count: NonNullable<unknown>;
};
