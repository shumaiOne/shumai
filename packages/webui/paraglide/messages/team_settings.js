/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Team_SettingsInputs */

const en_team_settings = /** @type {(inputs: Team_SettingsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Team Settings`)
};

const zh_team_settings = /** @type {(inputs: Team_SettingsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`团队设置`)
};

/**
* | output |
* | --- |
* | "Team Settings" |
*
* @param {Team_SettingsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const team_settings = /** @type {((inputs?: Team_SettingsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Team_SettingsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_team_settings(inputs)
	return zh_team_settings(inputs)
});