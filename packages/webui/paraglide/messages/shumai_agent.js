/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Shumai_AgentInputs */

const en_shumai_agent = /** @type {(inputs: Shumai_AgentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Shumai Agent`)
};

const zh_shumai_agent = /** @type {(inputs: Shumai_AgentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`数脉智能体`)
};

/**
* | output |
* | --- |
* | "Shumai Agent" |
*
* @param {Shumai_AgentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const shumai_agent = /** @type {((inputs?: Shumai_AgentInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Shumai_AgentInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_shumai_agent(inputs)
	return zh_shumai_agent(inputs)
});