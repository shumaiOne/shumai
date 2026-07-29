/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_SessionsInputs */

const en_agent_sessions = /** @type {(inputs: Agent_SessionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Sessions`)
};

const zh_agent_sessions = /** @type {(inputs: Agent_SessionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`会话记录`)
};

/**
* | output |
* | --- |
* | "Sessions" |
*
* @param {Agent_SessionsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_sessions = /** @type {((inputs?: Agent_SessionsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_SessionsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agent_sessions(inputs)
	return zh_agent_sessions(inputs)
});