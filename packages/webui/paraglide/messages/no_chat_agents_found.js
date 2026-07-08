/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Chat_Agents_FoundInputs */

const en_no_chat_agents_found = /** @type {(inputs: No_Chat_Agents_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No active chat agents found. Please create/enable one in the Agents tab first.`)
};

const zh_no_chat_agents_found = /** @type {(inputs: No_Chat_Agents_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未找到启用的聊天智能体。请先在“智能体”标签页中创建或启用。`)
};

/**
* | output |
* | --- |
* | "No active chat agents found. Please create/enable one in the Agents tab first." |
*
* @param {No_Chat_Agents_FoundInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_chat_agents_found = /** @type {((inputs?: No_Chat_Agents_FoundInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Chat_Agents_FoundInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_chat_agents_found(inputs)
	return zh_no_chat_agents_found(inputs)
});