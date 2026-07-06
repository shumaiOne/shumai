/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} TeamInputs */

const en_team = /** @type {(inputs: TeamInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`team`)
};

const zh_team = /** @type {(inputs: TeamInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`团队`)
};

/**
* | output |
* | --- |
* | "team" |
*
* @param {TeamInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const team = /** @type {((inputs?: TeamInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<TeamInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_team(inputs)
	return zh_team(inputs)
});