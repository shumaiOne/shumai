/**
* | output |
* | --- |
* | "Video Strategy" |
*
* @param {Video_StrategyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const video_strategy: ((inputs?: Video_StrategyInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Video_StrategyInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Video_StrategyInputs = {};
