/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Media_Processing_DescriptionInputs */

const en_media_processing_description = /** @type {(inputs: Media_Processing_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Manage your team's media transcoding configurations.`)
};

const zh_media_processing_description = /** @type {(inputs: Media_Processing_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`管理团队的媒体转码配置。`)
};

/**
* | output |
* | --- |
* | "Manage your team's media transcoding configurations." |
*
* @param {Media_Processing_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const media_processing_description = /** @type {((inputs?: Media_Processing_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Media_Processing_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_media_processing_description(inputs)
	return zh_media_processing_description(inputs)
});