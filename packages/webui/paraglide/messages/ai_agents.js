/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Ai_AgentsInputs */

const en_ai_agents = /** @type {(inputs: Ai_AgentsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`AI Agents`)
};

const zh_ai_agents = /** @type {(inputs: Ai_AgentsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`AI 智能体`)
};

/**
* | output |
* | --- |
* | "AI Agents" |
*
* @param {Ai_AgentsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const ai_agents = /** @type {((inputs?: Ai_AgentsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Ai_AgentsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_ai_agents(inputs)
	return zh_ai_agents(inputs)
});