/**
* | output |
* | --- |
* | "{count} enabled" |
*
* @param {Video_Models_CountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const video_models_count: ((inputs: Video_Models_CountInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Video_Models_CountInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Video_Models_CountInputs = {
    count: NonNullable<unknown>;
};
