/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Remove_From_ContextInputs */

const en_remove_from_context = /** @type {(inputs: Remove_From_ContextInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Remove from context`)
};

const zh_remove_from_context = /** @type {(inputs: Remove_From_ContextInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`从上下文中移除`)
};

/**
* | output |
* | --- |
* | "Remove from context" |
*
* @param {Remove_From_ContextInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const remove_from_context = /** @type {((inputs?: Remove_From_ContextInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Remove_From_ContextInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_remove_from_context(inputs)
	return zh_remove_from_context(inputs)
});