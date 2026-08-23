/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Blocked_ByInputs */

const en_blocked_by = /** @type {(inputs: Blocked_ByInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Blocked By (Prerequisites)`)
};

const zh_blocked_by = /** @type {(inputs: Blocked_ByInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`前置依赖（被阻止）`)
};

/**
* | output |
* | --- |
* | "Blocked By (Prerequisites)" |
*
* @param {Blocked_ByInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const blocked_by = /** @type {((inputs?: Blocked_ByInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Blocked_ByInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_blocked_by(inputs)
	return zh_blocked_by(inputs)
});