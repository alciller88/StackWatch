
# [0.10.0](https://github.com/alciller88/StackWatch/compare/v0.8.0...v0.10.0) (2026-03-18)


### Bug Fixes

* electron-builder v26 linux.desktop schema (StartupWMClass → entry) ([04deb81](https://github.com/alciller88/StackWatch/commit/04deb81c058e48903c81e106c956cb4197b1c2a7))
* regenerate package-lock.json for clean npm ci ([915ab04](https://github.com/alciller88/StackWatch/commit/915ab04c7b25076c7ec306326b465456b450333a))

# [0.8.0](https://github.com/alciller88/StackWatch/compare/v0.7.0...v0.8.0) (2026-03-18)


### Bug Fixes

* bidirectional sync between FlowGraph nodes and ServicesPanel ([62df26d](https://github.com/alciller88/StackWatch/commit/62df26d35adade8f7ce65761c8b718f17a431bd0))
* keep vuln scan button always visible and re-scannable ([f9b568e](https://github.com/alciller88/StackWatch/commit/f9b568ee1867e12232154d7d42488ddd01b19c9a))
* persist vuln scan results in store + feed to Stack Score ([1b0f87f](https://github.com/alciller88/StackWatch/commit/1b0f87fb0f9a573f3c89ac95635a0489b6635525))
* rename Semantic Detection to Heuristic Detection in README ([1f4fd0b](https://github.com/alciller88/StackWatch/commit/1f4fd0bc984586ba81ae777f66da1bc5e0b3b4eb))
* set custom window icon instead of default Electron icon ([09b9eae](https://github.com/alciller88/StackWatch/commit/09b9eae8fa0c1419861b939a7a0156425ef49845))
* show scan mode dialog whenever project has been scanned before ([129749c](https://github.com/alciller88/StackWatch/commit/129749cd3e1fbe863294b45c5e1c4c12ccefcd76))
* stable layout for scan button, remove redundant vuln badges ([65f4056](https://github.com/alciller88/StackWatch/commit/65f40565d308fc1f6e75fc0c4a5bcf111bf40985))
* Stack Score UX improvements from analysis review ([005a879](https://github.com/alciller88/StackWatch/commit/005a879851f08e0e7ec8d4f7b6f68373c552267d)), closes [#60a5fa](https://github.com/alciller88/StackWatch/issues/60a5fa)
* unique check labels, medium/low vuln info, cleaner breakdown ([1dabbdc](https://github.com/alciller88/StackWatch/commit/1dabbdcb746f71df1ac6c8a7ca531d7519ac88df))


### Features

* billing fields in FlowGraph NodeEditPanel + viewport clamping ([715f5e8](https://github.com/alciller88/StackWatch/commit/715f5e8e3a90a5774e9a1ed8d8a8ffce56bdb9ac))
* regenerate all icon formats from updated SVG ([23d3c22](https://github.com/alciller88/StackWatch/commit/23d3c223216ceda415267ec628fada284c1190d4)), closes [#0a0c0f](https://github.com/alciller88/StackWatch/issues/0a0c0f) [#e2b04a](https://github.com/alciller88/StackWatch/issues/e2b04a)
* ScoreBreakdown panel + fix Sidebar checks + fix history tooltip ([be042d4](https://github.com/alciller88/StackWatch/commit/be042d458fc17804eec0a05f5fddb3ff4681291a))
* ServiceBilling model + 8 binary Stack Score checks ([77e683d](https://github.com/alciller88/StackWatch/commit/77e683dedd8ec211b0410608e797499caf5aaa0c))

# [0.7.0](https://github.com/alciller88/StackWatch/compare/v0.6.0...v0.7.0) (2026-03-18)


### Bug Fixes

* Phase 1 bugs — race condition, circular dep, typed store, toast animation ([31c04fc](https://github.com/alciller88/StackWatch/commit/31c04fcb98218d2b042003de48fee307a1c61a2f))
* Phase 2 UI/UX — semantic colors, a11y, WCAG contrast, keyboard nav ([cfa5a4f](https://github.com/alciller88/StackWatch/commit/cfa5a4f4a8a22fe54435d85592da77423c0171f8))
* resolve TypeScript errors in electron-store typing ([7b2158d](https://github.com/alciller88/StackWatch/commit/7b2158d0a1110e094ad64c9ca42806eaef2e4bf3))


### Features

* reactive Stack Score with real-time recalculation and history persistence ([e727773](https://github.com/alciller88/StackWatch/commit/e727773967b62b69830a6e20cf6aba960fdf9a25))
* scan progress screen with real-time pipeline updates and cancellation ([bea85ff](https://github.com/alciller88/StackWatch/commit/bea85ff559260fb37748e47e61346546a8a7a4a5))

# [0.6.0](https://github.com/alciller88/StackWatch/compare/v0.4.0...v0.6.0) (2026-03-17)


### Bug Fixes

* **ci:** use --publish never to prevent electron-builder auto-publish ([73dc63a](https://github.com/alciller88/StackWatch/commit/73dc63a7ae89fd70d796980b15dd140f2f93b834))
* correct loadFile path for packaged app (blank screen on launch) ([b725235](https://github.com/alciller88/StackWatch/commit/b725235ee1a445c45a245d1a9f411ac148a3f62d))
* downgrade eslint to ^9.0.0 for eslint-plugin-react-hooks compatibility ([bc25dc9](https://github.com/alciller88/StackWatch/commit/bc25dc9793c1bbf0586ccd95adff59a54caea6d4))


### Features

* regenerate all icon formats from new SVG + icon generation script ([01741ed](https://github.com/alciller88/StackWatch/commit/01741ed1c405613cc4d3b1ab27dfa43b408cb809))

# [0.4.0](https://github.com/alciller88/StackWatch/compare/71b991085f9693988100ed9fc17dbdb8f23fb807...v0.4.0) (2026-03-17)


### Bug Fixes

* accept full GitHub URLs in repo connection modal ([cc5cb4d](https://github.com/alciller88/StackWatch/commit/cc5cb4dc0e203bba90d6b8cbaf30156419efd24b))
* AI filter now reviews ALL services, not just low-confidence ([14c5ab7](https://github.com/alciller88/StackWatch/commit/14c5ab74793c865e76c33697193953cc2f20f8d4)), closes [non-hi#confidence](https://github.com/non-hi/issues/confidence)
* all detected services now appear in flow graph ([d6b03d9](https://github.com/alciller88/StackWatch/commit/d6b03d977e97bc274fc18be0aa5876a64527f328))
* all services appear in graph + editable from Services panel ([60e43b4](https://github.com/alciller88/StackWatch/commit/60e43b4f0c6c0dc144c33ba554b4a1634bc7f5e8))
* auto-download Windows Electron on WSL2 and switch to CommonJS ([782e287](https://github.com/alciller88/StackWatch/commit/782e2879d4e6be44269e7b04a25becb802224eb1))
* card text overflow + auto-navigate to flow graph after scan/import ([3fb9f5d](https://github.com/alciller88/StackWatch/commit/3fb9f5d2fe797b66f6325413730e5ccd193d2974))
* compile Electron TS before launch and guard against missing preload API ([297e3df](https://github.com/alciller88/StackWatch/commit/297e3df444e3416fa8367ff92efee45330f4c1bf))
* confidence dropdown visibility in service edit form ([3264569](https://github.com/alciller88/StackWatch/commit/32645693d440915005aeb2917fcb0ca3afbebcd9))
* correct VALID_CATEGORIES.has() type cast for readonly tuple ([ee8d796](https://github.com/alciller88/StackWatch/commit/ee8d796b2c077201152fb0100e1b26f33d0f0d63))
* detect API URLs in constants and env vars with KEY/SECRET/TOKEN suffixes ([29667f6](https://github.com/alciller88/StackWatch/commit/29667f631959b0825d0dedd8f6b3730e437fbd15))
* detect missing WSL2 system deps before launching Electron ([81a34e9](https://github.com/alciller88/StackWatch/commit/81a34e92aa3b51a0e553448641d0f3d90dff78c9))
* disable CSP in development mode to allow Vite HMR ([5beb749](https://github.com/alciller88/StackWatch/commit/5beb7493d1367da473f2740e9b4c90f61fe09cf5))
* electron-store crash on re-launch (non-deterministic encryption key) ([efae057](https://github.com/alciller88/StackWatch/commit/efae057b842e7f97b023716806e665831df077a7))
* exclude own project name from detected services and graph nodes ([42a9422](https://github.com/alciller88/StackWatch/commit/42a94227547754acd8d56a170f89358495c1bb19))
* exclude test files from scanner to prevent false positives ([36e7e1a](https://github.com/alciller88/StackWatch/commit/36e7e1a43d3e0239226295ceef4d15dbe1fccda4))
* exclude test fixtures from tsconfig.node.json compilation ([ed3ae56](https://github.com/alciller88/StackWatch/commit/ed3ae566800fb465fc7da1e0fb613b36ed1631d1))
* extract only real API calls, filter content URLs and own domain ([ee3873a](https://github.com/alciller88/StackWatch/commit/ee3873a87487243b635da97607e4499fe65ab642))
* guarantee 1:1 mapping between Services panel and Flow Graph ([4ff8510](https://github.com/alciller88/StackWatch/commit/4ff8510e7543d10952a8355e1bcbce4268f9dc3b))
* hard cap on AI prompt size to prevent 413 errors ([6f19206](https://github.com/alciller88/StackWatch/commit/6f192062ee9750c726cbe245ddee087a74644497))
* import restores full stack with service↔node linkage ([ffa3729](https://github.com/alciller88/StackWatch/commit/ffa372953b74e28e90cae32b323780594230cced))
* import works without repo loaded — show panels when data exists ([6d464f9](https://github.com/alciller88/StackWatch/commit/6d464f99f4ec3fdbf589f8750e338fa881d378d6))
* layer nodes overridden by stale saved config nodeType ([4b065fa](https://github.com/alciller88/StackWatch/commit/4b065fab56765993ae5fa1bb993d1f0f575a6c3f))
* maximize on launch, boost font contrast, center dashboard ([6ec3f6f](https://github.com/alciller88/StackWatch/commit/6ec3f6f87eb8a25ac5c96cc5b9181a5b2a627739)), closes [#c8cdd5](https://github.com/alciller88/StackWatch/issues/c8cdd5) [#dce1e8](https://github.com/alciller88/StackWatch/issues/dce1e8) [#4a5a6e](https://github.com/alciller88/StackWatch/issues/4a5a6e) [#7a8da6](https://github.com/alciller88/StackWatch/issues/7a8da6) [#2a3545](https://github.com/alciller88/StackWatch/issues/2a3545) [#4a5a70](https://github.com/alciller88/StackWatch/issues/4a5a70)
* migrate old node types in importStandalone and fix NodeEditPanel dropdown ([f4f5b76](https://github.com/alciller88/StackWatch/commit/f4f5b765f0c0a34a6e007fdc2db34b15b929b1d9))
* migrate remaining old node types to type: 'layer' ([3fa96ca](https://github.com/alciller88/StackWatch/commit/3fa96ca5bff205f6089afdfcd075caa6414ea116))
* npm allowlist, GitHub auth/rate-limit, path guards, zombie perf, cleanup ([a5e8948](https://github.com/alciller88/StackWatch/commit/a5e89480c7ef3b53abd92d1eb6f76665a738acd4))
* prevent 413 errors by limiting AI prompt payload size ([d540260](https://github.com/alciller88/StackWatch/commit/d540260957479abeea93dccfc0ce490b06141333))
* prevent overlapping graph nodes on import ([21f2a91](https://github.com/alciller88/StackWatch/commit/21f2a916fde8d83b258b244e7c87d04ffc1b0a2a))
* raise AI filter cap to 100, remove debug logs ([3ff978e](https://github.com/alciller88/StackWatch/commit/3ff978e38df0956487b636a12d0fa1926e55ad68))
* remove broken screenshot placeholders from README ([83e8b4f](https://github.com/alciller88/StackWatch/commit/83e8b4fec7bc189d3341a6f43211a60ca95b1ab7))
* remove needsReview references on HeuristicResult in deduplicator ([43ddc8b](https://github.com/alciller88/StackWatch/commit/43ddc8b58f63052e4efd14ce4beccac1c47fe20d))
* remove own domain from services + correct app node label in graph ([0f32d9b](https://github.com/alciller88/StackWatch/commit/0f32d9b1d34ecfbb7dd7a60294d2583f122840ea))
* remove redundant auto/manual source badge from service cards ([2250ea6](https://github.com/alciller88/StackWatch/commit/2250ea6ff85dc5b62ab31816ef4e7084c8cd6c97))
* reset graph layout on re-analyze and new project scan ([44d0830](https://github.com/alciller88/StackWatch/commit/44d0830770eecb0b720917a72c9f4f8c304bd001))
* resolve 6 bugs, eliminate code duplication, add 25 tests ([bf1be2d](https://github.com/alciller88/StackWatch/commit/bf1be2dbb0da99a1967b35519addf1269f4c806c))
* run AI calls sequentially to avoid 429 rate limit errors ([c6671be](https://github.com/alciller88/StackWatch/commit/c6671be149cc5eafaf540ed2102611369b3c7e57))
* score by unique evidence type, not additive per instance ([627e6d4](https://github.com/alciller88/StackWatch/commit/627e6d4b72f33f956b7d4a4da31cb0c593b3fc9c))
* score reactivity, graph↔service sync, false positive filtering, cancel button ([2feca26](https://github.com/alciller88/StackWatch/commit/2feca263207ec167c9012eb381cbb41a98426a31))
* security hardening, CSP completeness, UI/a11y fixes ([2f642c7](https://github.com/alciller88/StackWatch/commit/2f642c70febde0e419190751518530d0e9921284))
* simplify import/export — no disk writes, versioned filenames ([8a70473](https://github.com/alciller88/StackWatch/commit/8a7047335b890506228db694dc465acdf3956dda))
* support Electron launch on WSL2 by detecting environment and using Windows binary ([dbbfc54](https://github.com/alciller88/StackWatch/commit/dbbfc5478a7e3ddfbbeb370dc8b0d3f3aae7b776))
* TS2339 — reason property does not exist on Partial<Service> ([8008890](https://github.com/alciller88/StackWatch/commit/8008890d8b42c01330e355838af34aacaae2f670))
* tsconfig.node.json include for healthScore, test type fix ([c23d5b2](https://github.com/alciller88/StackWatch/commit/c23d5b27cf106f5c327e97a3b56ac2ce7b8ecef3))
* use electron.exe in WSL2 instead of Linux binary ([77c51d9](https://github.com/alciller88/StackWatch/commit/77c51d9f50753d6b5d2fc316d41a8271cedd5932))
* widen rootDir in tsconfig.node.json to include shared/ ([baa9f4b](https://github.com/alciller88/StackWatch/commit/baa9f4b4931c6d72808025757f1beb3e60bac1b4))


### Features

* add Blank Stack mode for manual architecture building ([db9e9c1](https://github.com/alciller88/StackWatch/commit/db9e9c1000904f14443de34b17f6074835fba7e6))
* add Discarded panel showing items filtered during analysis ([ee40017](https://github.com/alciller88/StackWatch/commit/ee4001790517cf0bd5b1515a8e28c842a9bd257e))
* add layer node type for organizational graph nodes ([e960fb1](https://github.com/alciller88/StackWatch/commit/e960fb1db43337a08e27e7fba0de9287a69fd9ab))
* add scan mode dialog (merge vs fresh) before re-scanning repos ([68b900a](https://github.com/alciller88/StackWatch/commit/68b900aea011df64a90dc4ff49e9d33103f8f6ef))
* aggressive false-positive filtering, brand collapse dedup, CLI --all flag ([b83e89d](https://github.com/alciller88/StackWatch/commit/b83e89d79b707894749b78118a87505571b44c11))
* AI false-positive filter (Step 0) in analysis pipeline ([2ab9b0d](https://github.com/alciller88/StackWatch/commit/2ab9b0d8491af441dbb69c8db8fa80ad0257f149))
* budget mode, score history chart, light/dark theme toggle ([e9bf676](https://github.com/alciller88/StackWatch/commit/e9bf676c5d24d514f55a03911f73bcb2c7822cd2))
* CLI exit codes & init command, simplified AI presets, typography ([f0a5f1d](https://github.com/alciller88/StackWatch/commit/f0a5f1d6a93db57440ff94e3cc0166401b49b5f3))
* CLI tool, GitHub Action, README overhaul ([cf33078](https://github.com/alciller88/StackWatch/commit/cf330787abbb2eada8e0e3c3930c4d3bbe2bb8b0))
* custom frameless titlebar matching app aesthetic ([19150e8](https://github.com/alciller88/StackWatch/commit/19150e85fe7bbbbd943c13870d39e77c55b7fe44))
* deep AI analysis — service context, hidden detection, smart graph edges ([85056d8](https://github.com/alciller88/StackWatch/commit/85056d892c1eed653294e3756ae4f52bf2c97f63))
* distributable builds, monorepo support, build validation ([4996729](https://github.com/alciller88/StackWatch/commit/49967298c4af5570bdaa6e5c6f6502d4556720b8))
* dynamic Stack Score badges, vulnerability detection (OSV.dev) ([a3c29a5](https://github.com/alciller88/StackWatch/commit/a3c29a5bc8ae8b308c856bd5ebafa3272bd13f73))
* editable confidence field + re-analyze UX fix ([54da84d](https://github.com/alciller88/StackWatch/commit/54da84dbcb88d8da830ddcf1e5d8e88300d518de))
* evidence info popover and graph diff visual on re-scan ([67a096e](https://github.com/alciller88/StackWatch/commit/67a096e7699084792401449c7accf6bba5985816))
* expand scope to all project types, add multi-ecosystem analyzers ([498126b](https://github.com/alciller88/StackWatch/commit/498126ba05111847f1607b71312d2b98268edcb7))
* fix ai-only scan mode + AI evidence classification + update README ([47075b4](https://github.com/alciller88/StackWatch/commit/47075b4e764f8645c84007a0b78554656f68022e))
* hierarchical 4-layer flow graph layout ([d2aef84](https://github.com/alciller88/StackWatch/commit/d2aef84fc75336b59407a4b5335f9589bdbb46f9))
* implement full v0.1 application scaffold and core features ([71b9910](https://github.com/alciller88/StackWatch/commit/71b991085f9693988100ed9fc17dbdb8f23fb807))
* intelligent heuristic detection + any OpenAI-compatible AI provider ([21c89df](https://github.com/alciller88/StackWatch/commit/21c89dfb485523deadaabfa6cd0f3a2305d8f301))
* interactive flow graph with context menu, node editing and custom connections ([c9c045e](https://github.com/alciller88/StackWatch/commit/c9c045ed89b5c5101bcc2d4e10431a0f11f7de56))
* multi-step AI pipeline for ai-only scan mode ([8bab45b](https://github.com/alciller88/StackWatch/commit/8bab45bf995e20cae9ef85d417b964e22ba8333d))
* pre-launch hardening — encryption, error handling, integration tests, docs ([a9e175e](https://github.com/alciller88/StackWatch/commit/a9e175e44bbe91c59c6fa1d3f977b72250dee18a))
* React component tests, a11y improvements, toast system, CSS hover migration ([bf14d11](https://github.com/alciller88/StackWatch/commit/bf14d114cf8b064fefa404f6733a55d53553bf59))
* recommended AI providers (Groq/Ollama) + manual service form ([70de69a](https://github.com/alciller88/StackWatch/commit/70de69ac52115c5e96297fdf0737e3b72d622c9e))
* remove native menu + custom topbar with import/export ([c6ed6c3](https://github.com/alciller88/StackWatch/commit/c6ed6c387c88b3795109459151ffba781647f81d))
* replace ai-only with AI refinement of heuristic results ([5d69d6a](https://github.com/alciller88/StackWatch/commit/5d69d6a8253bdf0977f7638ff84c3d3dcad424d7))
* replace native OS dialogs with custom themed confirmation modals ([c41c0be](https://github.com/alciller88/StackWatch/commit/c41c0becb4d9dcecedfcfb697f5c998eed565891))
* scan mode selector + filter generic false positives ([3f4d6d9](https://github.com/alciller88/StackWatch/commit/3f4d6d9788cbd0ed0b7bf886381fa2646bdc5539))
* security hardening, perf optimizations, a11y, code quality sweep ([a668e97](https://github.com/alciller88/StackWatch/commit/a668e97553528c71b08f0feebeb740f6c7dc1c3d)), closes [#8090a6](https://github.com/alciller88/StackWatch/issues/8090a6)
* semantic evidence scoring system replaces hardcoded npm allowlist ([c095ab3](https://github.com/alciller88/StackWatch/commit/c095ab3977511e36cc0d724b88fa5e11c4e2cbf8))
* Sprint 1 — security hardening, AI resilience, accessibility ([b6da4fc](https://github.com/alciller88/StackWatch/commit/b6da4fc776dcc337ca6738b0d997866dbfac6807))
* Sprint 2 — UX improvements, costs panel, GitHub modal, empty states ([24adf55](https://github.com/alciller88/StackWatch/commit/24adf55e51baa58c6cf8f0510d22c4b9d2268242))
* Sprint 3 — CSP, encrypted storage, tests, error boundary ([b435000](https://github.com/alciller88/StackWatch/commit/b435000f956e869fdc485d37fa5d27a491cbbced))
* Sprint 4 — onboarding, ownership, badge, about, dashboard redesign ([05bf392](https://github.com/alciller88/StackWatch/commit/05bf3922b2cbdca728a1192e4f0690b2952ffa40))
* Stack Diff, SBOM generation, badge CLI, notifications, cost charts ([d44c27e](https://github.com/alciller88/StackWatch/commit/d44c27ec83e7403b6b993f529db4600a9bb1f9e5))
* stack source reference, linked/unlinked status, rescan confirmation ([3241a64](https://github.com/alciller88/StackWatch/commit/3241a64ada47d16d674493898c08c50bd4db53fa))
* standalone import without repo + fix flow graph node colors ([9a6f6b6](https://github.com/alciller88/StackWatch/commit/9a6f6b693fafb0ed82e565538d7c1627656e4371))
* static HTML export, AI stack alternatives ([06d6a6f](https://github.com/alciller88/StackWatch/commit/06d6a6ff89dd1e49057b8753a029cef13c1db0e2))
* UI redesign with CSS custom properties and minimal monospace theme ([ec991c9](https://github.com/alciller88/StackWatch/commit/ec991c9bd3dac32a72a14e309f53884abdf808ae))
* undo/redo, list virtualization, skeleton loaders ([87464a9](https://github.com/alciller88/StackWatch/commit/87464a91c4db7d3077a837795e2037bb032235a9))
* v0.4.0 — quality sweep, UX polish, health score, and launch prep ([bba5ed6](https://github.com/alciller88/StackWatch/commit/bba5ed60252e5ae7bdaa3f138cabccf5a8894543))
* zombie detector, score history, doctor CLI command ([0d87628](https://github.com/alciller88/StackWatch/commit/0d87628374a6a6661e73560bd441ab5ee4ead98e))
* zombie UI, doctor modal, 43 new tests ([c70d1a4](https://github.com/alciller88/StackWatch/commit/c70d1a46e8656c4456f6a81e07130bd189d88c9a))


### Performance Improvements

* optimize AI pipeline — filter/refine only medium/low confidence ([ca72422](https://github.com/alciller88/StackWatch/commit/ca72422746999608740ea43ec84704a6b83cef25)), closes [hi#confidence](https://github.com/hi/issues/confidence)
