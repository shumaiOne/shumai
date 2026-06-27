/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Skill_To_Get_StartedInputs */

const en_add_skill_to_get_started = /** @type {(inputs: Add_Skill_To_Get_StartedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Add a skill via GitHub URL or upload a ZIP file to get started.`)
};

const zh_add_skill_to_get_started = /** @type {(inputs: Add_Skill_To_Get_StartedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`通过 GitHub URL 添加技能或上传 ZIP 文件以开始使用。`)
};

/**
* | output |
* | --- |
* | "Add a skill via GitHub URL or upload a ZIP file to get started." |
*
* @param {Add_Skill_To_Get_StartedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_skill_to_get_started = /** @type {((inputs?: Add_Skill_To_Get_StartedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Skill_To_Get_StartedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_add_skill_to_get_started(inputs)
	return zh_add_skill_to_get_started(inputs)
});