/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Skills_Management_DescriptionInputs */

const en_skills_management_description = /** @type {(inputs: Skills_Management_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Extend your chatbot's capabilities with custom skills.`)
};

const zh_skills_management_description = /** @type {(inputs: Skills_Management_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`使用自定义技能扩展聊天机器人的功能。`)
};

/**
* | output |
* | --- |
* | "Extend your chatbot's capabilities with custom skills." |
*
* @param {Skills_Management_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const skills_management_description = /** @type {((inputs?: Skills_Management_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Skills_Management_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_skills_management_description(inputs)
	return zh_skills_management_description(inputs)
});