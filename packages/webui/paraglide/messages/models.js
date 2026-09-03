/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ModelsInputs */

const en_models = /** @type {(inputs: ModelsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Models`)
};

const zh_models = /** @type {(inputs: ModelsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`模型列表`)
};

/**
* | output |
* | --- |
* | "Models" |
*
* @param {ModelsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const models = /** @type {((inputs?: ModelsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ModelsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_models(inputs)
	return zh_models(inputs)
});