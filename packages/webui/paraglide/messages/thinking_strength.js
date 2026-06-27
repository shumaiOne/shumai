/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Thinking_StrengthInputs */

const en_thinking_strength = /** @type {(inputs: Thinking_StrengthInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Thinking Strength`)
};

const zh_thinking_strength = /** @type {(inputs: Thinking_StrengthInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`思考强度`)
};

/**
* | output |
* | --- |
* | "Thinking Strength" |
*
* @param {Thinking_StrengthInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const thinking_strength = /** @type {((inputs?: Thinking_StrengthInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Thinking_StrengthInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_thinking_strength(inputs)
	return zh_thinking_strength(inputs)
});