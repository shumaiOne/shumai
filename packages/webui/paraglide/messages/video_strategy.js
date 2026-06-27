/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Video_StrategyInputs */

const en_video_strategy = /** @type {(inputs: Video_StrategyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Video Strategy`)
};

const zh_video_strategy = /** @type {(inputs: Video_StrategyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`视频策略`)
};

/**
* | output |
* | --- |
* | "Video Strategy" |
*
* @param {Video_StrategyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const video_strategy = /** @type {((inputs?: Video_StrategyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Video_StrategyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_video_strategy(inputs)
	return zh_video_strategy(inputs)
});