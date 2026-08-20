/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} KanbanInputs */

const en_kanban = /** @type {(inputs: KanbanInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Kanban`)
};

const zh_kanban = /** @type {(inputs: KanbanInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`看板`)
};

/**
* | output |
* | --- |
* | "Kanban" |
*
* @param {KanbanInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const kanban = /** @type {((inputs?: KanbanInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<KanbanInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_kanban(inputs)
	return zh_kanban(inputs)
});