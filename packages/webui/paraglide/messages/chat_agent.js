/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Chat_AgentInputs */

const en_chat_agent = /** @type {(inputs: Chat_AgentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Chat Agent`)
};

const zh_chat_agent = /** @type {(inputs: Chat_AgentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`对话智能体`)
};

/**
* | output |
* | --- |
* | "Chat Agent" |
*
* @param {Chat_AgentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const chat_agent = /** @type {((inputs?: Chat_AgentInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Chat_AgentInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_chat_agent(inputs)
	return zh_chat_agent(inputs)
});