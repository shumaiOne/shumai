/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_AgentInputs */

const en_select_agent = /** @type {(inputs: Select_AgentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select an agent`)
};

const zh_select_agent = /** @type {(inputs: Select_AgentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择智能体`)
};

/**
* | output |
* | --- |
* | "Select an agent" |
*
* @param {Select_AgentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_agent = /** @type {((inputs?: Select_AgentInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_AgentInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_agent(inputs)
	return zh_select_agent(inputs)
});