/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Enter_Skill_IdInputs */

const en_enter_skill_id = /** @type {(inputs: Enter_Skill_IdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Enter Skill ID`)
};

const zh_enter_skill_id = /** @type {(inputs: Enter_Skill_IdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`输入技能 ID`)
};

/**
* | output |
* | --- |
* | "Enter Skill ID" |
*
* @param {Enter_Skill_IdInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const enter_skill_id = /** @type {((inputs?: Enter_Skill_IdInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Enter_Skill_IdInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_enter_skill_id(inputs)
	return zh_enter_skill_id(inputs)
});