/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Assets_Added_To_ContextInputs */

const en_assets_added_to_context = /** @type {(inputs: Assets_Added_To_ContextInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Assets added to context:`)
};

const zh_assets_added_to_context = /** @type {(inputs: Assets_Added_To_ContextInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已添加至上下文的资源：`)
};

/**
* | output |
* | --- |
* | "Assets added to context:" |
*
* @param {Assets_Added_To_ContextInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const assets_added_to_context = /** @type {((inputs?: Assets_Added_To_ContextInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Assets_Added_To_ContextInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_assets_added_to_context(inputs)
	return zh_assets_added_to_context(inputs)
});