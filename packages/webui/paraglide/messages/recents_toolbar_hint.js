/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Recents_Toolbar_HintInputs */

const en_recents_toolbar_hint = /** @type {(inputs: Recents_Toolbar_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This page displays the 100 most recent files you viewed in this project.`)
};

const zh_recents_toolbar_hint = /** @type {(inputs: Recents_Toolbar_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`此页面显示您最近在当前项目中查看过的 100 个文件。`)
};

/**
* | output |
* | --- |
* | "This page displays the 100 most recent files you viewed in this project." |
*
* @param {Recents_Toolbar_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const recents_toolbar_hint = /** @type {((inputs?: Recents_Toolbar_HintInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Recents_Toolbar_HintInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_recents_toolbar_hint(inputs)
	return zh_recents_toolbar_hint(inputs)
});