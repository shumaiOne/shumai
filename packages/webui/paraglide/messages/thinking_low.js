/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Thinking_LowInputs */

const en_thinking_low = /** @type {(inputs: Thinking_LowInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Low`)
};

const zh_thinking_low = /** @type {(inputs: Thinking_LowInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`低`)
};

/**
* | output |
* | --- |
* | "Low" |
*
* @param {Thinking_LowInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const thinking_low = /** @type {((inputs?: Thinking_LowInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Thinking_LowInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_thinking_low(inputs)
	return zh_thinking_low(inputs)
});