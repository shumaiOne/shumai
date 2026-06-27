/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_New_SkillInputs */

const en_add_new_skill = /** @type {(inputs: Add_New_SkillInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Add New Skill`)
};

const zh_add_new_skill = /** @type {(inputs: Add_New_SkillInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`添加新技能`)
};

/**
* | output |
* | --- |
* | "Add New Skill" |
*
* @param {Add_New_SkillInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_new_skill = /** @type {((inputs?: Add_New_SkillInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_New_SkillInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_add_new_skill(inputs)
	return zh_add_new_skill(inputs)
});