/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Team_ViewInputs */

const en_team_view = /** @type {(inputs: Team_ViewInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Team`)
};

const zh_team_view = /** @type {(inputs: Team_ViewInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`团队`)
};

/**
* | output |
* | --- |
* | "Team" |
*
* @param {Team_ViewInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const team_view = /** @type {((inputs?: Team_ViewInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Team_ViewInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_team_view(inputs)
	return zh_team_view(inputs)
});