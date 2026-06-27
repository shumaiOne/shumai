/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} AgentsInputs */

const en_agents = /** @type {(inputs: AgentsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Agents`)
};

const zh_agents = /** @type {(inputs: AgentsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`智能体`)
};

/**
* | output |
* | --- |
* | "Agents" |
*
* @param {AgentsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agents = /** @type {((inputs?: AgentsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<AgentsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agents(inputs)
	return zh_agents(inputs)
});