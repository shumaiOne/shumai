/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Thinking_MediumInputs */

const en_thinking_medium = /** @type {(inputs: Thinking_MediumInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Medium`)
};

const zh_thinking_medium = /** @type {(inputs: Thinking_MediumInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`中`)
};

/**
* | output |
* | --- |
* | "Medium" |
*
* @param {Thinking_MediumInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const thinking_medium = /** @type {((inputs?: Thinking_MediumInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Thinking_MediumInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_thinking_medium(inputs)
	return zh_thinking_medium(inputs)
});