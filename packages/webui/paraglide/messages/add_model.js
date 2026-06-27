/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_ModelInputs */

const en_add_model = /** @type {(inputs: Add_ModelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Add Model`)
};

const zh_add_model = /** @type {(inputs: Add_ModelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`添加模型`)
};

/**
* | output |
* | --- |
* | "Add Model" |
*
* @param {Add_ModelInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_model = /** @type {((inputs?: Add_ModelInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_ModelInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_add_model(inputs)
	return zh_add_model(inputs)
});