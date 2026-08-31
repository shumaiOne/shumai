/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Thinking_StatusInputs */

const en_thinking_status = /** @type {(inputs: Thinking_StatusInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Thinking...`)
};

const zh_thinking_status = /** @type {(inputs: Thinking_StatusInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`思考中...`)
};

/**
* | output |
* | --- |
* | "Thinking..." |
*
* @param {Thinking_StatusInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const thinking_status = /** @type {((inputs?: Thinking_StatusInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Thinking_StatusInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_thinking_status(inputs)
	return zh_thinking_status(inputs)
});