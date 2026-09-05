/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Enabled_Media_ModelsInputs */

const en_enabled_media_models = /** @type {(inputs: Enabled_Media_ModelsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Enabled Models`)
};

const zh_enabled_media_models = /** @type {(inputs: Enabled_Media_ModelsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已启用模型`)
};

/**
* | output |
* | --- |
* | "Enabled Models" |
*
* @param {Enabled_Media_ModelsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const enabled_media_models = /** @type {((inputs?: Enabled_Media_ModelsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Enabled_Media_ModelsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_enabled_media_models(inputs)
	return zh_enabled_media_models(inputs)
});