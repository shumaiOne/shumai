/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} GoalsInputs */

const en_goals = /** @type {(inputs: GoalsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Goals`)
};

const zh_goals = /** @type {(inputs: GoalsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`目标`)
};

/**
* | output |
* | --- |
* | "Goals" |
*
* @param {GoalsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const goals = /** @type {((inputs?: GoalsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<GoalsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_goals(inputs)
	return zh_goals(inputs)
});