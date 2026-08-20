/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} UnassignedInputs */

const en_unassigned = /** @type {(inputs: UnassignedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Unassigned`)
};

const zh_unassigned = /** @type {(inputs: UnassignedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未指派`)
};

/**
* | output |
* | --- |
* | "Unassigned" |
*
* @param {UnassignedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const unassigned = /** @type {((inputs?: UnassignedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<UnassignedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_unassigned(inputs)
	return zh_unassigned(inputs)
});