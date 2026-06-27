/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Skills_AvailableInputs */

const en_no_skills_available = /** @type {(inputs: No_Skills_AvailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No skills available.`)
};

const zh_no_skills_available = /** @type {(inputs: No_Skills_AvailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`暂无可用技能。`)
};

/**
* | output |
* | --- |
* | "No skills available." |
*
* @param {No_Skills_AvailableInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_skills_available = /** @type {((inputs?: No_Skills_AvailableInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Skills_AvailableInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_skills_available(inputs)
	return zh_no_skills_available(inputs)
});