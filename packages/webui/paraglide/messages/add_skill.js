/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_SkillInputs */

const en_add_skill = /** @type {(inputs: Add_SkillInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Add Skill`)
};

const zh_add_skill = /** @type {(inputs: Add_SkillInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`添加技能`)
};

/**
* | output |
* | --- |
* | "Add Skill" |
*
* @param {Add_SkillInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_skill = /** @type {((inputs?: Add_SkillInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_SkillInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_add_skill(inputs)
	return zh_add_skill(inputs)
});