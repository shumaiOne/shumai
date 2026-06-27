/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Visible_CountInputs */

const en_visible_count = /** @type {(inputs: Visible_CountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`(${i?.count} visible)`)
};

const zh_visible_count = /** @type {(inputs: Visible_CountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`（${i?.count} 个可见）`)
};

/**
* | output |
* | --- |
* | "({count} visible)" |
*
* @param {Visible_CountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const visible_count = /** @type {((inputs: Visible_CountInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Visible_CountInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_visible_count(inputs)
	return zh_visible_count(inputs)
});