/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Chat_Agents_WarningInputs */

const en_no_chat_agents_warning = /** @type {(inputs: No_Chat_Agents_WarningInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No chat agents found. Please create a Chat Agent below first.`)
};

const zh_no_chat_agents_warning = /** @type {(inputs: No_Chat_Agents_WarningInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未找到聊天智能体。请先在下方创建聊天智能体。`)
};

/**
* | output |
* | --- |
* | "No chat agents found. Please create a Chat Agent below first." |
*
* @param {No_Chat_Agents_WarningInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_chat_agents_warning = /** @type {((inputs?: No_Chat_Agents_WarningInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Chat_Agents_WarningInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_chat_agents_warning(inputs)
	return zh_no_chat_agents_warning(inputs)
});