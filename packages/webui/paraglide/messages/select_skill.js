/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_SkillInputs */

const en_select_skill = /** @type {(inputs: Select_SkillInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select Skill`)
};

const zh_select_skill = /** @type {(inputs: Select_SkillInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择 Skill`)
};

/**
* | output |
* | --- |
* | "Select Skill" |
*
* @param {Select_SkillInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_skill = /** @type {((inputs?: Select_SkillInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_SkillInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_skill(inputs)
	return zh_select_skill(inputs)
});