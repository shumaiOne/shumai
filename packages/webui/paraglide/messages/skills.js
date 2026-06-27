/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} SkillsInputs */

const en_skills = /** @type {(inputs: SkillsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Skills`)
};

const zh_skills = /** @type {(inputs: SkillsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`技能`)
};

/**
* | output |
* | --- |
* | "Skills" |
*
* @param {SkillsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const skills = /** @type {((inputs?: SkillsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<SkillsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_skills(inputs)
	return zh_skills(inputs)
});