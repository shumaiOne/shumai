/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Video_Models_CountInputs */

const en_video_models_count = /** @type {(inputs: Video_Models_CountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} enabled`)
};

const zh_video_models_count = /** @type {(inputs: Video_Models_CountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} 个已启用`)
};

/**
* | output |
* | --- |
* | "{count} enabled" |
*
* @param {Video_Models_CountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const video_models_count = /** @type {((inputs: Video_Models_CountInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Video_Models_CountInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_video_models_count(inputs)
	return zh_video_models_count(inputs)
});