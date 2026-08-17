/**
* | output |
* | --- |
* | "Team Shared Pool" |
*
* @param {Quota_Team_Shared_PoolInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_team_shared_pool: ((inputs?: Quota_Team_Shared_PoolInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Team_Shared_PoolInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Team_Shared_PoolInputs = {};
