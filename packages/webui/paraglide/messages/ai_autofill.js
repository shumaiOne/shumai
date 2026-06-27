/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Ai_AutofillInputs */

const en_ai_autofill = /** @type {(inputs: Ai_AutofillInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`AI Autofill`)
};

const zh_ai_autofill = /** @type {(inputs: Ai_AutofillInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`AI 自动填充`)
};

/**
* | output |
* | --- |
* | "AI Autofill" |
*
* @param {Ai_AutofillInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const ai_autofill = /** @type {((inputs?: Ai_AutofillInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Ai_AutofillInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_ai_autofill(inputs)
	return zh_ai_autofill(inputs)
});