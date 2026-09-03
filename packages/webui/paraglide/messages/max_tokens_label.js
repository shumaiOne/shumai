/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Max_Tokens_LabelInputs */

const en_max_tokens_label = /** @type {(inputs: Max_Tokens_LabelInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`max ${i?.count}`)
};

const zh_max_tokens_label = /** @type {(inputs: Max_Tokens_LabelInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`最大 ${i?.count}`)
};

/**
* | output |
* | --- |
* | "max {count}" |
*
* @param {Max_Tokens_LabelInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const max_tokens_label = /** @type {((inputs: Max_Tokens_LabelInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Max_Tokens_LabelInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_max_tokens_label(inputs)
	return zh_max_tokens_label(inputs)
});