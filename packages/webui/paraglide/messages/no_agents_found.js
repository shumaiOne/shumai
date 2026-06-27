/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ type: NonNullable<unknown> }} No_Agents_FoundInputs */

const en_no_agents_found = /** @type {(inputs: No_Agents_FoundInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`No ${i?.type} agents found`)
};

const zh_no_agents_found = /** @type {(inputs: No_Agents_FoundInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`未找到${i?.type}智能体`)
};

/**
* | output |
* | --- |
* | "No {type} agents found" |
*
* @param {No_Agents_FoundInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_agents_found = /** @type {((inputs: No_Agents_FoundInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Agents_FoundInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_agents_found(inputs)
	return zh_no_agents_found(inputs)
});