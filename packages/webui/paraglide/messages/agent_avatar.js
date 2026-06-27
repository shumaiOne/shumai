/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_AvatarInputs */

const en_agent_avatar = /** @type {(inputs: Agent_AvatarInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Agent Avatar`)
};

const zh_agent_avatar = /** @type {(inputs: Agent_AvatarInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`智能体头像`)
};

/**
* | output |
* | --- |
* | "Agent Avatar" |
*
* @param {Agent_AvatarInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_avatar = /** @type {((inputs?: Agent_AvatarInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_AvatarInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agent_avatar(inputs)
	return zh_agent_avatar(inputs)
});