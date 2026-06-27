/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deep_ReasoningInputs */

const en_deep_reasoning = /** @type {(inputs: Deep_ReasoningInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Deep reasoning`)
};

const zh_deep_reasoning = /** @type {(inputs: Deep_ReasoningInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`深度推理`)
};

/**
* | output |
* | --- |
* | "Deep reasoning" |
*
* @param {Deep_ReasoningInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const deep_reasoning = /** @type {((inputs?: Deep_ReasoningInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deep_ReasoningInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deep_reasoning(inputs)
	return zh_deep_reasoning(inputs)
});