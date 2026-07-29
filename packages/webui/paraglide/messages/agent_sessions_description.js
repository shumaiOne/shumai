/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_Sessions_DescriptionInputs */

const en_agent_sessions_description = /** @type {(inputs: Agent_Sessions_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`View step-by-step execution history and logs for all agent sessions across your team.`)
};

const zh_agent_sessions_description = /** @type {(inputs: Agent_Sessions_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`查看全团队所有 AI Agent 会话的执行历史与日志。`)
};

/**
* | output |
* | --- |
* | "View step-by-step execution history and logs for all agent sessions across your team." |
*
* @param {Agent_Sessions_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_sessions_description = /** @type {((inputs?: Agent_Sessions_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_Sessions_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agent_sessions_description(inputs)
	return zh_agent_sessions_description(inputs)
});