/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Models_CountInputs */

const en_models_count = /** @type {(inputs: Models_CountInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Models`)
};

const zh_models_count = /** @type {(inputs: Models_CountInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`模型`)
};

/**
* | output |
* | --- |
* | "Models" |
*
* @param {Models_CountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const models_count = /** @type {((inputs?: Models_CountInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Models_CountInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_models_count(inputs)
	return zh_models_count(inputs)
});