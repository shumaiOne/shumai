/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Media_Type_VideoInputs */

const en_media_type_video = /** @type {(inputs: Media_Type_VideoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Video`)
};

const zh_media_type_video = /** @type {(inputs: Media_Type_VideoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`视频`)
};

/**
* | output |
* | --- |
* | "Video" |
*
* @param {Media_Type_VideoInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const media_type_video = /** @type {((inputs?: Media_Type_VideoInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Media_Type_VideoInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_media_type_video(inputs)
	return zh_media_type_video(inputs)
});