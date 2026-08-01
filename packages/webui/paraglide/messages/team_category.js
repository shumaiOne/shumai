/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Team_CategoryInputs */

const en_team_category = /** @type {(inputs: Team_CategoryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Team`)
};

const zh_team_category = /** @type {(inputs: Team_CategoryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`团队`)
};

/**
* | output |
* | --- |
* | "Team" |
*
* @param {Team_CategoryInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const team_category = /** @type {((inputs?: Team_CategoryInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Team_CategoryInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_team_category(inputs)
	return zh_team_category(inputs)
});