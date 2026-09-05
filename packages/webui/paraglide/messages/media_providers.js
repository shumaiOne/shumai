/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Media_ProvidersInputs */

const en_media_providers = /** @type {(inputs: Media_ProvidersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Media Providers`)
};

const zh_media_providers = /** @type {(inputs: Media_ProvidersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`媒体提供商`)
};

/**
* | output |
* | --- |
* | "Media Providers" |
*
* @param {Media_ProvidersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const media_providers = /** @type {((inputs?: Media_ProvidersInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Media_ProvidersInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_media_providers(inputs)
	return zh_media_providers(inputs)
});