# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **transcode**: Add HDR output proxy support with team settings (SDR, HDR, or both), high-fidelity SDR tone-mapping for previews and proxies, Dolby Vision Profile 5 support, and automatic HDR player playback on supported displays
- **docs**: Add a Changelog section to the documentation site so users can explore release notes and updates directly in Mintlify

### Fixed

- **docker**: Fix an issue where the bundled PostgreSQL container published port 5432 on the host, causing deployment to fail on machines where that port was already in use; the database is now only reachable by Shumai itself
- **cli**: Only manage and check PID files in daemon mode, preventing stale PID files, crash-loop conflicts, or spurious process checks during normal foreground and Docker execution

### Changed

## [0.4.7] - 2026-09-19

### Added

- **changelog**: Introduce Keep a Changelog support, historical release summaries, and automated release notes extraction
- **release**: Automatically populate GitHub release bodies from CHANGELOG.md and promote unreleased notes during version bumps
- **settings**: Add FFmpeg threads slider to team media processing settings
- **asset**: Show previews of a folder's contents and a "days left" countdown for each item in Recently Deleted
- **asset**: Show the poster and hover preview for a video in the file list while it is still transcoding, with a gently pulsing cover (or an animated waiting circle before the poster is ready), "Uploading..."/"Preparing..." labels, and the duration hidden until it is ready

### Fixed

- **asset**: Fix an issue where moving a video to trash while it was still transcoding could cause it to lose its trashed status
- **transcode**: Immediately stop background video processing and transcoding when a file is permanently deleted from the trash
- **asset**: Fix proxy download filename using original file extension instead of proxy extension
- **asset**: Fix an issue where deleting or restoring a version stack from the file list did nothing
- **webui**: Center breadcrumb file action popup menu on the chevron icon

## [0.4.6] - 2026-09-17

### Added

- **comment**: Add emoji reaction support for comments ([#405](https://github.com/shumaiOne/shumai/pull/405))
- **premiere-uxp**: Introduce Adobe Premiere Pro UXP plugin for Shumai ([#407](https://github.com/shumaiOne/shumai/pull/407))
- **settings**: Add team appearance setting to hide agent features ([#411](https://github.com/shumaiOne/shumai/pull/411))

### Fixed

- **premiere-uxp**: Preserve remote cloud storage presigned URLs in asset resolution ([#408](https://github.com/shumaiOne/shumai/pull/408))
- **premiere-uxp**: Scope sequence links by server endpoint and surface sync errors ([#409](https://github.com/shumaiOne/shumai/pull/409))
- **api**: Enforce SHUMAI_DEMO_MODE for API token and CLI requests ([#413](https://github.com/shumaiOne/shumai/pull/413))

### Documentation

- Add NLE export and Premiere Pro UXP plugin documentation ([#412](https://github.com/shumaiOne/shumai/pull/412))

## [0.4.5] - 2026-09-13

### Added

- **core**: Export comments to FCP, Premiere, Media Composer, and Resolve ([#400](https://github.com/shumaiOne/shumai/pull/400))
- **webui**: Add NLE comments export and migrate export API to POST ([#401](https://github.com/shumaiOne/shumai/pull/401))
- **webui**: Add space key quick preview for files and folders ([#402](https://github.com/shumaiOne/shumai/pull/402))
- **webui**: Show comments count badge in file card preview area ([#403](https://github.com/shumaiOne/shumai/pull/403))
- **agent**: Use deterministic storage keys for preset avatars ([#404](https://github.com/shumaiOne/shumai/pull/404))

## [0.4.4] - 2026-09-09

### Added

- **upload**: S3 multipart upload with offline resume and wake lock ([#391](https://github.com/shumaiOne/shumai/pull/391))
- **transcode**: Optimize video operations using ffmpeg http range requests ([#393](https://github.com/shumaiOne/shumai/pull/393))
- **agent**: Enable read_asset tool for autofill agent ([#396](https://github.com/shumaiOne/shumai/pull/396))
- **sandbox**: Abstract SandboxService and hot-reload allowed domains ([#398](https://github.com/shumaiOne/shumai/pull/398))

### Fixed

- **s3**: Stream downloadToFile and putObject to prevent OOM on large files ([#392](https://github.com/shumaiOne/shumai/pull/392))
- **agent**: Pass agent thinkingLevel to session name generation ([#395](https://github.com/shumaiOne/shumai/pull/395))
- **agent**: Restrict pageCount and duration recommendations to matching media types ([#397](https://github.com/shumaiOne/shumai/pull/397))
- **transcode**: Co-locate screenshots and derived artifacts in asset storage directory ([#399](https://github.com/shumaiOne/shumai/pull/399))

## [0.4.3] - 2026-09-06

### Added

- **asset**: Record and display agent provenance on assets and audit logs ([#380](https://github.com/shumaiOne/shumai/pull/380))
- **agent**: Store preset avatars as real files in s3 storage ([#381](https://github.com/shumaiOne/shumai/pull/381))
- **agent**: Add built-in image and video generation tools and settings ([#382](https://github.com/shumaiOne/shumai/pull/382))
- **media-generation**: Add gemini-omni-1.1-flash video model and redesign settings UI ([#383](https://github.com/shumaiOne/shumai/pull/383))
- **settings**: Redesign image/video settings to provider dialog with model toggles ([#385](https://github.com/shumaiOne/shumai/pull/385))
- **agent**: Add asset management tools and CLI commands ([#387](https://github.com/shumaiOne/shumai/pull/387))
- **cli**: Control asset deletion via SHUMAI_ALLOW_DELETE env var ([#388](https://github.com/shumaiOne/shumai/pull/388))

### Fixed

- **webui**: Clamp file card creation info to 2 lines and show tooltip on hover ([#390](https://github.com/shumaiOne/shumai/pull/390))

### Documentation

- **agents**: Add documentation for image and video generation settings ([#389](https://github.com/shumaiOne/shumai/pull/389))

### Maintenance

- **deps**: Upgrade bun to 1.4.2 and update packages ([#384](https://github.com/shumaiOne/shumai/pull/384))
- **i18n**: Update paraglide-js to 2.25.0 and stop checking in generated code ([#386](https://github.com/shumaiOne/shumai/pull/386))

## [0.4.2] - 2026-09-03

### Added

- **chat**: Support markups, attachments, and timestamps in agent 1-to-1 chat ([#368](https://github.com/shumaiOne/shumai/pull/368))
- **agent**: Move thread metadata to structured context XML ([#373](https://github.com/shumaiOne/shumai/pull/373))
- **agent**: Improve timestamp precision and proxy selection for video screenshots ([#374](https://github.com/shumaiOne/shumai/pull/374))
- **agent**: Support dynamic annotationId resolution across chat and comments ([#375](https://github.com/shumaiOne/shumai/pull/375))
- **agent**: Consolidate media tools into read_asset and add S3 key support to download_asset ([#376](https://github.com/shumaiOne/shumai/pull/376))
- **provider**: Optimize provider and model configuration management ([#377](https://github.com/shumaiOne/shumai/pull/377))
- **provider**: Add provider and model sync feature with vendored generator ([#378](https://github.com/shumaiOne/shumai/pull/378))

### Fixed

- **agent**: Set empty details in asset tool results to avoid data duplication ([#370](https://github.com/shumaiOne/shumai/pull/370))
- **webui**: Strip styles and preserve multiline text on paste in chat input ([#371](https://github.com/shumaiOne/shumai/pull/371))
- **agent**: Hide main comment sessions in dashboard sessions list ([#372](https://github.com/shumaiOne/shumai/pull/372))

### Changed

- **webui**: Use semantic system colors in notification settings ([#379](https://github.com/shumaiOne/shumai/pull/379))

## [0.4.1] - 2026-08-30

### Added

- **webui**: Add manage versions option to file card context menu ([#364](https://github.com/shumaiOne/shumai/pull/364))
- **agent**: Refactor message context into unified shumai_message ([#365](https://github.com/shumaiOne/shumai/pull/365))
- **webui**: Redesign comment attachment display into compact rows ([#366](https://github.com/shumaiOne/shumai/pull/366))

### Fixed

- **asset,webui**: Disallow dropping version stacks onto files and version stacks ([#363](https://github.com/shumaiOne/shumai/pull/363))
- **webui**: Prevent empty folder flash during initial loading ([#367](https://github.com/shumaiOne/shumai/pull/367))

### Changed

- **agent**: Remove executeAgentToolWorkflow and invoke core services directly ([#362](https://github.com/shumaiOne/shumai/pull/362))

## [0.4.0] - 2026-08-28

### Added

- **transcode**: Add hardware-accelerated video transcoding support ([#352](https://github.com/shumaiOne/shumai/pull/352))
- **webui**: Truncate long file names with 100ms hover tooltip ([#355](https://github.com/shumaiOne/shumai/pull/355))
- **webui**: Add simplified mobile-friendly layout for file and share lists ([#356](https://github.com/shumaiOne/shumai/pull/356))
- **webui**: Add mobile friendly file detail and public share view ([#359](https://github.com/shumaiOne/shumai/pull/359))

### Fixed

- **transcode**: Apply team hardware acceleration and source bitrate capping to watermark transcoding ([#353](https://github.com/shumaiOne/shumai/pull/353))
- **share**: Hide and soft-delete symlinks when target assets are trashed ([#354](https://github.com/shumaiOne/shumai/pull/354))
- **webui**: Fix breadcrumb file dropdown trigger stretching and alignment ([#360](https://github.com/shumaiOne/shumai/pull/360))
- **webui**: Align mobile comment cards and thread vertical indicator ([#361](https://github.com/shumaiOne/shumai/pull/361))

### Documentation

- Add SECURITY.md with a private disclosure path ([#357](https://github.com/shumaiOne/shumai/pull/357))

## [0.3.11] - 2026-08-25

### Added

- **auth**: Add admin password reset CLI command and reset password web UI ([#347](https://github.com/shumaiOne/shumai/pull/347))
- **project**: Add recent viewed files section to project folder tree ([#348](https://github.com/shumaiOne/shumai/pull/348))

### Fixed

- **webui**: Prevent left carousel remounting and scroll jump on file selection ([#351](https://github.com/shumaiOne/shumai/pull/351))

## [0.3.10] - 2026-08-23

### Added

- **agentic kanban**: Phase 1 not-agentic kanban board ([#330](https://github.com/shumaiOne/shumai/pull/330))
- **kanban**: Resolve latest version for linked version stack assets and update demo login text ([#342](https://github.com/shumaiOne/shumai/pull/342))
- **kanban**: Update task status permissions, reporter defaults, and participant access ([#345](https://github.com/shumaiOne/shumai/pull/345))

### Fixed

- **kanban**: Use true thumbnail and poster for task asset previews ([#343](https://github.com/shumaiOne/shumai/pull/343))
- **webui**: Sidebar selection styling, kanban active state, pointer cursors, and owner dashboard ([#344](https://github.com/shumaiOne/shumai/pull/344))
- **kanban**: Improve drag-drop to column bottom, remove empty drop line, and fix timeline alignment ([#346](https://github.com/shumaiOne/shumai/pull/346))

## [0.3.9] - 2026-08-18

### Added

- **agent**: Add permission controls for chat agents ([#313](https://github.com/shumaiOne/shumai/pull/313))
- **authz**: Enforce project-aware roles for agent/skill/mcp permissions ([#314](https://github.com/shumaiOne/shumai/pull/314))
- **webui**: Use project members for asset comment mentions ([#315](https://github.com/shumaiOne/shumai/pull/315))
- **quota**: Add 2-level database-backed resource quota system ([#318](https://github.com/shumaiOne/shumai/pull/318))
- **settings**: Reorganize settings into personal, team, and AI sections ([#324](https://github.com/shumaiOne/shumai/pull/324))
- **quota**: Move usage monitoring to team dashboard ([#327](https://github.com/shumaiOne/shumai/pull/327))

### Fixed

- **webui**: Preserve selected chatbot agent preference on reload ([#323](https://github.com/shumaiOne/shumai/pull/323))
- **quota**: Exclude agents from quota rules and usage records ([#325](https://github.com/shumaiOne/shumai/pull/325))

### Documentation

- **team-settings**: Add resource quotas documentation and update readme features ([#326](https://github.com/shumaiOne/shumai/pull/326))

## [0.3.8] - 2026-08-15

### Added

- **webui**: Replace legacy markdown editor with new lexical wysiwyg editor ([#308](https://github.com/shumaiOne/shumai/pull/308))
- **agent**: Add nested agents.md support across backend and webui ([#309](https://github.com/shumaiOne/shumai/pull/309))
- **webui**: Improve AGENTS.md editor placeholder and read-only notice ([#310](https://github.com/shumaiOne/shumai/pull/310))
- **version-stack**: Add manage versions dialog and version removal ([#311](https://github.com/shumaiOne/shumai/pull/311))

### Fixed

- **core**: Rename latest version child record on version stack rename ([#312](https://github.com/shumaiOne/shumai/pull/312))

## [0.3.7] - 2026-08-14

### Added

- **metadata**: Replace aiAutofill boolean with autofillSource enum ([#302](https://github.com/shumaiOne/shumai/pull/302))
- **agent**: Type-safe CREATION_CONTEXT metadata on create_file/create_version ([#303](https://github.com/shumaiOne/shumai/pull/303))
- **sandbox**: Default Network Sandbox to off and add settings toggle switch ([#304](https://github.com/shumaiOne/shumai/pull/304))
- **webui**: Redesign select metadata fields and improve long text field widget ([#305](https://github.com/shumaiOne/shumai/pull/305))
- **agent**: Support dynamic newOption in select and selectMulti metadata fields ([#306](https://github.com/shumaiOne/shumai/pull/306))

### Fixed

- **webui**: Fix select field height and multi-select overflow/interaction issues ([#307](https://github.com/shumaiOne/shumai/pull/307))

## [0.3.6] - 2026-08-12

### Added

- **mcp**: Add MCP server support with proxy tool and OAuth flow ([#289](https://github.com/shumaiOne/shumai/pull/289))
- **mcp**: Support tool-level directTools array and 3-state UI configuration ([#297](https://github.com/shumaiOne/shumai/pull/297))
- **webui**: Direct canvas PDF rendering with selectable text ([#299](https://github.com/shumaiOne/shumai/pull/299))

### Fixed

- **agent**: Prevent agents from accessing disabled skills ([#292](https://github.com/shumaiOne/shumai/pull/292))
- **agent**: Resolve version stack name and size in list_assets ([#296](https://github.com/shumaiOne/shumai/pull/296))
- **webui**: Content-only pinch-zoom and two-finger pan in media viewers ([#298](https://github.com/shumaiOne/shumai/pull/298))
- **i18n**: Update Chinese translation for dashboard to 仪表板 ([#301](https://github.com/shumaiOne/shumai/pull/301))

### Documentation

- **mcp**: Add MCP support documentation to README and docs ([#300](https://github.com/shumaiOne/shumai/pull/300))

## [0.3.5] - 2026-08-09

### Added

- **transcode**: Add Gotenberg support for Office, HTML, CSV, and Markdown PDF proxies ([#283](https://github.com/shumaiOne/shumai/pull/283))

### Fixed

- **webui**: Resolve upload card freeze for unsupported files ([#284](https://github.com/shumaiOne/shumai/pull/284))
- **webui**: Exclude file extension when selecting file name during inline rename ([#285](https://github.com/shumaiOne/shumai/pull/285))
- Use renamed asset name in download Content-Disposition ([#286](https://github.com/shumaiOne/shumai/pull/286))
- **webui**: Batch download no longer flashes a tab per file ([#287](https://github.com/shumaiOne/shumai/pull/287))
- **webui**: Enable rename and delete actions in file detail top bar breadcrumb ([#288](https://github.com/shumaiOne/shumai/pull/288))

## [0.3.4] - 2026-08-08

### Added

- **sharelink**: Add sharelink watermark support ([#270](https://github.com/shumaiOne/shumai/pull/270))
- **webui**: Remove original-file display fallbacks, use proxies only ([#273](https://github.com/shumaiOne/shumai/pull/273))
- **share**: Add allow download config to share links ([#275](https://github.com/shumaiOne/shumai/pull/275))
- **transcode**: Update preview thumbnail resolution to 300p with max length constraint ([#281](https://github.com/shumaiOne/shumai/pull/281))

### Fixed

- **share**: Resolve symlink asset downloads in public share pages ([#274](https://github.com/shumaiOne/shumai/pull/274))
- **webui**: Persist project sorting and prevent full page flash ([#276](https://github.com/shumaiOne/shumai/pull/276))

### Documentation

- **share-links**: Document allow download and lazy watermark settings ([#278](https://github.com/shumaiOne/shumai/pull/278))
- **agent**: Clarify create_file/create_version context param guidance ([#282](https://github.com/shumaiOne/shumai/pull/282))

### Maintenance

- **e2e**: Watermarked download-disabled share link coverage (image + video) ([#277](https://github.com/shumaiOne/shumai/pull/277))
- **e2e**: Stabilize watermark share spec on Firefox ([#279](https://github.com/shumaiOne/shumai/pull/279))
- Split e2e scripts into app and webui targets ([#280](https://github.com/shumaiOne/shumai/pull/280))

## [0.3.3] - 2026-08-05

### Added

- **agent**: Enable LLM API call retries in AgentHarness ([#250](https://github.com/shumaiOne/shumai/pull/250))
- **audit**: Add audit log support for APIs and WebUI dashboard ([#251](https://github.com/shumaiOne/shumai/pull/251))
- **webui**: Persist agent preference in localStorage ([#254](https://github.com/shumaiOne/shumai/pull/254))
- **e2e**: Add file domain comment and draw tests ([#260](https://github.com/shumaiOne/shumai/pull/260))
- **agent**: Restrict bash access for non-owner users ([#262](https://github.com/shumaiOne/shumai/pull/262))
- **agent**: Allow create_file tool to create files directly from content ([#263](https://github.com/shumaiOne/shumai/pull/263))
- **agent**: Propagate autofill context from chat to autofill workflow ([#264](https://github.com/shumaiOne/shumai/pull/264))
- **webui**: Render select options in field creation mode and pick random option color ([#265](https://github.com/shumaiOne/shumai/pull/265))
- **project**: Include team-scoped members in project member list and add 3-section dialog layout ([#267](https://github.com/shumaiOne/shumai/pull/267))
- **webui**: Disable role dropdown for project-scoped members in team view ([#269](https://github.com/shumaiOne/shumai/pull/269))

### Fixed

- **webui**: Mention popup avatars, keyboard auto-scroll, and non-sticky section headers ([#256](https://github.com/shumaiOne/shumai/pull/256))
- **webui**: Persist field order on drag and drop ([#266](https://github.com/shumaiOne/shumai/pull/266))

### Changed

- **agent**: Load models directly from database without pi fallback ([#253](https://github.com/shumaiOne/shumai/pull/253))
- **core**: Replace generated provider files with pi-ai dynamic methods ([#255](https://github.com/shumaiOne/shumai/pull/255))

### Maintenance

- **core**: Add missing tests for methods introduced in 97069042 ([#252](https://github.com/shumaiOne/shumai/pull/252))
- **e2e**: Add domain-based auth and project web app e2e tests ([#257](https://github.com/shumaiOne/shumai/pull/257))
- **e2e**: Add file, share, and collection web app e2e tests ([#258](https://github.com/shumaiOne/shumai/pull/258))
- **e2e**: Add project-level invite and file-move e2e tests ([#259](https://github.com/shumaiOne/shumai/pull/259))
- **e2e**: Add search in file list and save-search-as-collection cases ([#261](https://github.com/shumaiOne/shumai/pull/261))
- **e2e**: Add member permission change tests ([#268](https://github.com/shumaiOne/shumai/pull/268))

## [0.3.2] - 2026-07-30

### Added

- **agent**: Add output truncation and streaming limits to sandboxed bash tool ([#248](https://github.com/shumaiOne/shumai/pull/248))

### Fixed

- **agent**: Download original document asset instead of pdf proxy ([#247](https://github.com/shumaiOne/shumai/pull/247))
- **webui**: Persist chatbot sidebar input text across route navigation ([#249](https://github.com/shumaiOne/shumai/pull/249))

## [0.3.1] - 2026-07-30

### Added

- **transcode**: Trigger ai metadata autofill post transcode ([#234](https://github.com/shumaiOne/shumai/pull/234))
- **dashboard**: Add agent sessions view for team owners ([#237](https://github.com/shumaiOne/shumai/pull/237))
- **db**: Preserve agent sessions on asset deletion by setting onDelete to SetNull ([#240](https://github.com/shumaiOne/shumai/pull/240))
- **agent**: Add download_asset tool and prompt instructions ([#242](https://github.com/shumaiOne/shumai/pull/242))
- **db**: Update Asset.sizeByte and AiUsage token fields to BigInt ([#244](https://github.com/shumaiOne/shumai/pull/244))

### Fixed

- **agent**: Include select option labels and field name in autofill schema ([#235](https://github.com/shumaiOne/shumai/pull/235))
- **agent**: Scope agent comment sessions to thread sessions anchored at root comments ([#239](https://github.com/shumaiOne/shumai/pull/239))
- **agent**: Disable tools for session naming and make naming non-blocking ([#241](https://github.com/shumaiOne/shumai/pull/241))
- **webui**: Update file size formatting to SI decimal standard ([#245](https://github.com/shumaiOne/shumai/pull/245))
- **s3**: Enforce property syntax in S3Service interface and fix ReadableStream handling in S3StorageService ([#246](https://github.com/shumaiOne/shumai/pull/246))

## [0.3.0] - 2026-07-28

### Added

- **file-browser**: Add copy name and path option to context menu ([#225](https://github.com/shumaiOne/shumai/pull/225))
- **agent**: Inject user name and role into chat context ([#226](https://github.com/shumaiOne/shumai/pull/226))
- **agent**: Refactor database session storage to normalized DAG entries and lazy thread sync ([#229](https://github.com/shumaiOne/shumai/pull/229))
- **agent**: Support ENABLE_WEAKER_NESTED_SANDBOX environment variable ([#233](https://github.com/shumaiOne/shumai/pull/233))

### Fixed

- **agent**: Ensure atomic appendEntry and persist leaf entries in DatabaseSessionStorage ([#224](https://github.com/shumaiOne/shumai/pull/224))
- Sharp version mismatch bug ([#230](https://github.com/shumaiOne/shumai/pull/230))
- **agent**: Resolve S3 MIME type detection and prompt parameter in image analysis ([#232](https://github.com/shumaiOne/shumai/pull/232))

### Changed

- **agent**: Remove implicit agent mention trigger in comment threads ([#227](https://github.com/shumaiOne/shumai/pull/227))

### Maintenance

- **workflow**: Add docker compose deployment verification job ([#231](https://github.com/shumaiOne/shumai/pull/231))

## [0.2.3] - 2026-07-25

### Fixed

- **webui**: Show right sidebar by default on file detail page ([#219](https://github.com/shumaiOne/shumai/pull/219))
- **webui**: Refresh file list and detail when agent executes asset creation tools ([#220](https://github.com/shumaiOne/shumai/pull/220))
- **webui**: Fix space key drag overlay and shift range selection for version stacks ([#221](https://github.com/shumaiOne/shumai/pull/221))
- **transcode**: Handle timestamp rounding tolerance for screenshot annotations ([#223](https://github.com/shumaiOne/shumai/pull/223))

### Changed

- **e2e**: Split transcode workflow E2E tests into per-workflow test files ([#222](https://github.com/shumaiOne/shumai/pull/222))

## [0.2.2] - 2026-07-23

### Added

- **webui**: Integrate AI usage API into dashboard page ([#216](https://github.com/shumaiOne/shumai/pull/216))
- **ai-usage**: Add team and member token usage tracking and APIs ([#215](https://github.com/shumaiOne/shumai/pull/215))
- **transcode**: Add PSD support via ImageMagick and enforce sRGB conversion ([#217](https://github.com/shumaiOne/shumai/pull/217))

### Fixed

- **search**: Fix buildSqlCondition date range, numeric metadata, and string parsing bugs ([#213](https://github.com/shumaiOne/shumai/pull/213))
- **webui**: Prevent horizontal overflow in search dialog result rows ([#214](https://github.com/shumaiOne/shumai/pull/214))
- **webui**: Invalidate upload tasks query when upload task starts and completes ([#218](https://github.com/shumaiOne/shumai/pull/218))

## [0.2.1] - 2026-07-22

### Added

- **skill**: Add team owner skill permission control ([#209](https://github.com/shumaiOne/shumai/pull/209))

### Fixed

- **agent**: Handle non-builtin models in getModelFromDb and upgrade pi-ai ([#211](https://github.com/shumaiOne/shumai/pull/211))
- **provider**: Preserve model ids on provider update ([#212](https://github.com/shumaiOne/shumai/pull/212))

### Changed

- **core**: Split generated providers into per-provider files ([#210](https://github.com/shumaiOne/shumai/pull/210))

## [0.2.0] - 2026-07-21

### Added

- **transcode**: Add PDF preview, sprite generation, and annotation support ([#193](https://github.com/shumaiOne/shumai/pull/193))
- **web**: Register pdf.worker route in production ([#195](https://github.com/shumaiOne/shumai/pull/195))
- **agent**: Add read_pdf_pages tool and PDF page context support ([#196](https://github.com/shumaiOne/shumai/pull/196))
- **transcode**: Split monolithic transcodeMedia into focused workflows ([#197](https://github.com/shumaiOne/shumai/pull/197))
- **transcode**: Add PDF proxy support for TXT and CSV files ([#199](https://github.com/shumaiOne/shumai/pull/199))
- **asset**: Replace mediaType/mimeType logic with proxyType ([#200](https://github.com/shumaiOne/shumai/pull/200))
- **docker**: Install fonts-noto-cjk in runner stage ([#202](https://github.com/shumaiOne/shumai/pull/202))
- **transcode**: Add markdown file to pdf proxy support ([#203](https://github.com/shumaiOne/shumai/pull/203))
- **chat**: Track context asset changes and update agent context ([#204](https://github.com/shumaiOne/shumai/pull/204))
- **agent**: Refactor media tools to static injection with mandatory assetId and authz ([#208](https://github.com/shumaiOne/shumai/pull/208))

### Fixed

- **transcode**: Mark pdfkit as external and extract for docker runtime ([#201](https://github.com/shumaiOne/shumai/pull/201))
- **agent**: Include skill id in formatSkillsForPrompt ([#205](https://github.com/shumaiOne/shumai/pull/205))
- **asset**: Exclude soft-deleted children from latestChildren preview ([#206](https://github.com/shumaiOne/shumai/pull/206))
- **agent**: Pass latest version asset from version stack to prompt builder ([#207](https://github.com/shumaiOne/shumai/pull/207))

## [0.1.10] - 2026-07-16

### Added

- **workflow-e2e**: Add E2E tests for agentAutofillMedia workflow ([#188](https://github.com/shumaiOne/shumai/pull/188))
- **comments**: Support comment deletion and video player shortcuts ([#191](https://github.com/shumaiOne/shumai/pull/191))
- **agent**: Support disabling specific tools for agents ([#192](https://github.com/shumaiOne/shumai/pull/192))

### Maintenance

- **e2e**: Add E2E workflow tests for remaining agent and transcode services ([#189](https://github.com/shumaiOne/shumai/pull/189))

## [0.1.9] - 2026-07-14

### Added

- **e2e**: Set up fullstack app-level e2e test framework and signup test case ([#184](https://github.com/shumaiOne/shumai/pull/184))
- **chat**: Chatbot UI ([#185](https://github.com/shumaiOne/shumai/pull/185))
- **agent**: Support aborting agent execution ([#186](https://github.com/shumaiOne/shumai/pull/186))

### Changed

- **api/chat**: Remove direct Prisma query from API layer ([#187](https://github.com/shumaiOne/shumai/pull/187))

## [0.1.8] - 2026-07-10

### Added

- **chatbot**: Implement type-safe Chat APIs with compaction support ([#180](https://github.com/shumaiOne/shumai/pull/180))

### Fixed

- **webui**: Enable build splitting and code-split all page routes ([#183](https://github.com/shumaiOne/shumai/pull/183))

### Documentation

- **readme**: Clarify displayed file size represents original file size ([#182](https://github.com/shumaiOne/shumai/pull/182))

## [0.1.7] - 2026-07-06

### Added

- **audio**: Support frame-accurate audio playback, comments, and AI safeguards ([#175](https://github.com/shumaiOne/shumai/pull/175))
- **i18n**: Localize members dialog, notifications, uploads, user menus, dates, and players ([#178](https://github.com/shumaiOne/shumai/pull/178))
- **comments**: Allow marking comments as complete or incomplete ([#179](https://github.com/shumaiOne/shumai/pull/179))

### Fixed

- **upload**: Resolve empty and generic MIME types in confirmFileUpload ([#176](https://github.com/shumaiOne/shumai/pull/176))

### Changed

- **webui**: Modularize file viewer components into registry-driven architecture ([#174](https://github.com/shumaiOne/shumai/pull/174))

### Documentation

- Improve documentation and examples for S3 compatible storage ([#177](https://github.com/shumaiOne/shumai/pull/177))

## [0.1.6] - 2026-07-04

### Added

- **file-browser**: Show video duration on file card preview ([#170](https://github.com/shumaiOne/shumai/pull/170))
- **webui**: Compare versions view for version stacks ([#171](https://github.com/shumaiOne/shumai/pull/171))

### Fixed

- **webui**: Resolve conditional hooks and setState-in-render errors ([#167](https://github.com/shumaiOne/shumai/pull/167))
- **webui**: Resolve video player total frames mismatch ([#172](https://github.com/shumaiOne/shumai/pull/172))
- **version-stack**: Resolve correct latest version ID of version stack ([#173](https://github.com/shumaiOne/shumai/pull/173))

### Maintenance

- **webui**: Video player e2e framework + Safari playhead fix ([#166](https://github.com/shumaiOne/shumai/pull/166))
- **webui**: Add frame-accurate comment seek roundtrip e2e ([#168](https://github.com/shumaiOne/shumai/pull/168))
- **webui**: Verify video player restarts playback after end ([#169](https://github.com/shumaiOne/shumai/pull/169))

## [0.1.5] - 2026-07-02

### Changed

- **storage**: Use original filenames for stored files ([#165](https://github.com/shumaiOne/shumai/pull/165))

### Maintenance

- **release**: Add Aliyun ACR push to release workflow ([#164](https://github.com/shumaiOne/shumai/pull/164))

## [0.1.4] - 2026-07-01

### Added

- **transcode**: Change video poster resolution to 480p ([#161](https://github.com/shumaiOne/shumai/pull/161))
- **auth**: Allow setting user locale on signup ([#163](https://github.com/shumaiOne/shumai/pull/163))

### Fixed

- **webui**: Preserve video ended state by skipping playhead snap on ended ([#162](https://github.com/shumaiOne/shumai/pull/162))

## [0.1.3] - 2026-06-30

### Added

- **webui**: Add i18n support using paraglide-js ([#156](https://github.com/shumaiOne/shumai/pull/156))
- **video**: Add frame-accurate video player, SMPTE timecodes, and format switcher ([#157](https://github.com/shumaiOne/shumai/pull/157))

### Fixed

- **webui**: Align video timeline duration and formatting with frameio ([#158](https://github.com/shumaiOne/shumai/pull/158))
- **webui**: Fix missing left sidebar for nested folders ([#159](https://github.com/shumaiOne/shumai/pull/159))
- **api**: Fix update team settings and make request schema type-safe ([#160](https://github.com/shumaiOne/shumai/pull/160))

## [0.1.2] - 2026-06-25

### Changed

- **s3**: Remove automatic port appending to AWS_ENDPOINT_URL_S3 ([#155](https://github.com/shumaiOne/shumai/pull/155))

## [0.1.1] - 2026-06-23

### Added

- **docker**: Add root entrypoint with privilege dropping for data volumes ([#151](https://github.com/shumaiOne/shumai/pull/151))

## [0.1.0] - 2026-06-22

### Added

- **share**: Secure share info API and fix wrong password feedback ([#150](https://github.com/shumaiOne/shumai/pull/150))

### Fixed

- **webui**: Truncate long folder, collection, and share link names in sidebar ([#149](https://github.com/shumaiOne/shumai/pull/149))

## [0.0.11] - 2026-06-22

### Added

- **cli**: Add shumai-cli and token authentication ([#144](https://github.com/shumaiOne/shumai/pull/144))
- **settings**: Use singular headers and remove collapse/counters for single agent types ([#145](https://github.com/shumaiOne/shumai/pull/145))
- **folders**: Auto expand folder tree in left sidebar on navigation ([#146](https://github.com/shumaiOne/shumai/pull/146))
- **metadata**: Add single user and multiple user custom fields ([#147](https://github.com/shumaiOne/shumai/pull/147))

### Maintenance

- **cli**: Rename npm package to @shumai-one/shumai-cli ([#148](https://github.com/shumaiOne/shumai/pull/148))

## [0.0.10] - 2026-06-21

### Changed

- **web**: Dynamically register production HTML bundle routes ([#142](https://github.com/shumaiOne/shumai/pull/142))

### Documentation

- **readme**: Polish structure, correct grammar, and add dependencies table ([#143](https://github.com/shumaiOne/shumai/pull/143))

## [0.0.9] - 2026-06-20

### Added

- **webui**: Show app version in avatar menu ([#139](https://github.com/shumaiOne/shumai/pull/139))
- **cli**: Add background daemonization and subcommands ([#141](https://github.com/shumaiOne/shumai/pull/141))

### Maintenance

- **release**: Add smoke tests to local release stage ([#140](https://github.com/shumaiOne/shumai/pull/140))

## [0.0.8] - 2026-06-19

### Added

- **api**: Implement read-only mode for reviewers ([#122](https://github.com/shumaiOne/shumai/pull/122))
- **server**: Allow customizing server port via SHUMAI_SERVER_PORT ([#124](https://github.com/shumaiOne/shumai/pull/124))
- **embedding**: Defer embedding workflow, use transcoded assets, and execute chunks in separate activities ([#125](https://github.com/shumaiOne/shumai/pull/125))
- **webui**: Add external drag-and-drop file and folder upload support ([#126](https://github.com/shumaiOne/shumai/pull/126))
- **agent**: Implement overlapping video chunks for semantic search ([#127](https://github.com/shumaiOne/shumai/pull/127))
- **webui**: Support jumping to video timestamp from search results ([#128](https://github.com/shumaiOne/shumai/pull/128))
- **auth**: Add demo mode support ([#131](https://github.com/shumaiOne/shumai/pull/131))
- **auth**: Refine demo mode support ([#132](https://github.com/shumaiOne/shumai/pull/132))
- **webui**: Default right sidebar to collapsed for new users ([#133](https://github.com/shumaiOne/shumai/pull/133))
- **webui**: Use Shadcn Switch in toggle field and Rating component in search filter panel ([#137](https://github.com/shumaiOne/shumai/pull/137))
- **upload**: Track byte-level progress with XMLHttpRequest ([#138](https://github.com/shumaiOne/shumai/pull/138))

### Fixed

- **transcode**: Handle high-precision FPS using rational fractions ([#123](https://github.com/shumaiOne/shumai/pull/123))
- **db**: Automatically update project updatedAt on asset modification ([#129](https://github.com/shumaiOne/shumai/pull/129))
- **webui**: Use system colors for fields and improve search filter select options ([#130](https://github.com/shumaiOne/shumai/pull/130))
- **search**: Fix hasAny and hasNone operators on metadata filter ([#134](https://github.com/shumaiOne/shumai/pull/134))
- **webui**: Resolve folder tree sync, search dialog reset, and sidebar actions issues ([#136](https://github.com/shumaiOne/shumai/pull/136))

### Changed

- **webui**: Fix search dialog layout height, scroll areas, and restrict filter toggle click ([#135](https://github.com/shumaiOne/shumai/pull/135))

## [0.0.7] - 2026-06-17

### Added

- **workflow**: Configure transcode and agent concurrency via environment variables ([#116](https://github.com/shumaiOne/shumai/pull/116))
- **webui**: Replace hardcoded colors with system tokens ([#119](https://github.com/shumaiOne/shumai/pull/119))
- **webui**: Replace native overflow with shadcn ScrollArea in settings ([#120](https://github.com/shumaiOne/shumai/pull/120))
- **api**: Use enum for API protocol in provider config ([#121](https://github.com/shumaiOne/shumai/pull/121))

### Fixed

- **webui**: Reload video player and reset state when switching assets ([#114](https://github.com/shumaiOne/shumai/pull/114))

### Changed

- **transcode**: Relocate TranscodeService to core and flatten API package ([#115](https://github.com/shumaiOne/shumai/pull/115))

### Documentation

- Improve and restructure shumai documentation ([#118](https://github.com/shumaiOne/shumai/pull/118))

## [0.0.6] - 2026-06-15

### Added

- **sandbox**: Add pending domains support for network sandbox ([#109](https://github.com/shumaiOne/shumai/pull/109))
- **webui**: Always show right sidebar and implement left vertical carousel ([#111](https://github.com/shumaiOne/shumai/pull/111))

### Fixed

- **build**: Propagate termination signals to active child process in wrappers ([#102](https://github.com/shumaiOne/shumai/pull/102))
- **transcode**: Make deterministic transcode activity failures non-retryable in Temporal ([#104](https://github.com/shumaiOne/shumai/pull/104))
- **player**: Implement seekbar dragging and match hover highlight color ([#108](https://github.com/shumaiOne/shumai/pull/108))
- **webui**: Avoid refetching all pages on file/folder reorder ([#112](https://github.com/shumaiOne/shumai/pull/112))
- **webui**: Force video-player mime type to video/mp4 ([#113](https://github.com/shumaiOne/shumai/pull/113))

### Changed

- **webui**: Use system color design tokens in video player components ([#106](https://github.com/shumaiOne/shumai/pull/106))
- **webui**: Use requestAnimationFrame for smooth video progress bar updates ([#107](https://github.com/shumaiOne/shumai/pull/107))
- **webui**: Fetch agents in mention input list dynamically ([#110](https://github.com/shumaiOne/shumai/pull/110))

### Documentation

- **readme**: Add comprehensive README.md ([#103](https://github.com/shumaiOne/shumai/pull/103))
- **readme**: Improve remote deployment and temporal execution instructions ([#105](https://github.com/shumaiOne/shumai/pull/105))

## [0.0.5] - 2026-06-13

### Added

- **npm**: Auto deploy database migrations on package start ([#101](https://github.com/shumaiOne/shumai/pull/101))

## [0.0.4] - 2026-06-12

### Fixed

- **cli/docker**: Resolve global CLI external dependencies and fix Docker 404 error ([#100](https://github.com/shumaiOne/shumai/pull/100))

## [0.0.3] - 2026-06-12

### Fixed

- **cli**: Resolve platform binary path resolution under nested node_modules ([#99](https://github.com/shumaiOne/shumai/pull/99))

## [0.0.2] - 2026-06-12

### Fixed

- **npm**: Add repository metadata to package.json for provenance verification ([#98](https://github.com/shumaiOne/shumai/pull/98))

### Maintenance

- Add release-npm.yaml workflow ([#97](https://github.com/shumaiOne/shumai/pull/97))

## [0.0.1] - 2026-06-12

### Added

- Initial release of Shumai
