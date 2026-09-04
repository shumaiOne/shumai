/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ user: NonNullable<unknown>, agent: NonNullable<unknown> }} User_Via_AgentInputs */

const en_user_via_agent = /** @type {(inputs: User_Via_AgentInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.user} via ${i?.agent}`)
};

const zh_user_via_agent = /** @type {(inputs: User_Via_AgentInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.user} 通过 ${i?.agent}`)
};

/**
* | output |
* | --- |
* | "{user} via {agent}" |
*
* @param {User_Via_AgentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const user_via_agent = /** @type {((inputs: User_Via_AgentInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<User_Via_AgentInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_user_via_agent(inputs)
	return zh_user_via_agent(inputs)
});