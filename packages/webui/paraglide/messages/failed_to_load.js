/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_To_LoadInputs */

const en_failed_to_load = /** @type {(inputs: Failed_To_LoadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to load sessions`)
};

const zh_failed_to_load = /** @type {(inputs: Failed_To_LoadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`加载会话失败`)
};

/**
* | output |
* | --- |
* | "Failed to load sessions" |
*
* @param {Failed_To_LoadInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_load = /** @type {((inputs?: Failed_To_LoadInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_LoadInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_to_load(inputs)
	return zh_failed_to_load(inputs)
});