/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Reasoning_SupportInputs */

const en_reasoning_support = /** @type {(inputs: Reasoning_SupportInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Reasoning Support`)
};

const zh_reasoning_support = /** @type {(inputs: Reasoning_SupportInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`推理支持`)
};

/**
* | output |
* | --- |
* | "Reasoning Support" |
*
* @param {Reasoning_SupportInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const reasoning_support = /** @type {((inputs?: Reasoning_SupportInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Reasoning_SupportInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_reasoning_support(inputs)
	return zh_reasoning_support(inputs)
});