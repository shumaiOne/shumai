/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} AgentInputs */

const en_agent = /** @type {(inputs: AgentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Agent`)
};

const zh_agent = /** @type {(inputs: AgentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`智能体`)
};

/**
* | output |
* | --- |
* | "Agent" |
*
* @param {AgentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent = /** @type {((inputs?: AgentInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<AgentInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agent(inputs)
	return zh_agent(inputs)
});