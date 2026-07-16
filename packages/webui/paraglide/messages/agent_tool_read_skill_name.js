/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_Tool_Read_Skill_NameInputs */

const en_agent_tool_read_skill_name = /** @type {(inputs: Agent_Tool_Read_Skill_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Read Skills`)
};

const zh_agent_tool_read_skill_name = /** @type {(inputs: Agent_Tool_Read_Skill_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`读取技能`)
};

/**
* | output |
* | --- |
* | "Read Skills" |
*
* @param {Agent_Tool_Read_Skill_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_read_skill_name = /** @type {((inputs?: Agent_Tool_Read_Skill_NameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_Tool_Read_Skill_NameInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agent_tool_read_skill_name(inputs)
	return zh_agent_tool_read_skill_name(inputs)
});