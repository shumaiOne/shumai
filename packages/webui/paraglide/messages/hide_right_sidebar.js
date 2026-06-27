/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Hide_Right_SidebarInputs */

const en_hide_right_sidebar = /** @type {(inputs: Hide_Right_SidebarInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Hide Right Sidebar`)
};

const zh_hide_right_sidebar = /** @type {(inputs: Hide_Right_SidebarInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`隐藏右侧边栏`)
};

/**
* | output |
* | --- |
* | "Hide Right Sidebar" |
*
* @param {Hide_Right_SidebarInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const hide_right_sidebar = /** @type {((inputs?: Hide_Right_SidebarInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Hide_Right_SidebarInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_hide_right_sidebar(inputs)
	return zh_hide_right_sidebar(inputs)
});