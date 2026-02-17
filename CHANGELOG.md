# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [2.13.0](https://github.com/graasp/graasp/compare/v2.12.0...v2.13.0) (2026-02-17)


### Features

* allow switching from folder to capsule ([#2052](https://github.com/graasp/graasp/issues/2052)) ([d079383](https://github.com/graasp/graasp/commit/d079383e234db460506e41f89553462987d5f1a7))
* allow users to subscribe and unsubscribe to email notifications ([#2060](https://github.com/graasp/graasp/issues/2060)) ([af96280](https://github.com/graasp/graasp/commit/af96280f99c5028d7840db9e105b46213e24a1f5))
* export document item as html ([#2063](https://github.com/graasp/graasp/issues/2063)) ([5e6509a](https://github.com/graasp/graasp/commit/5e6509ac5feea11a90672fe654db39ce9d06875e))
* improve item discrimination ([#2074](https://github.com/graasp/graasp/issues/2074)) ([24eb5d7](https://github.com/graasp/graasp/commit/24eb5d7fa00c15bf6db9f62edbd7190c2f1bc25a))


### Bug Fixes

* correctly tee thumbnail stream on upload ([#2068](https://github.com/graasp/graasp/issues/2068)) ([69ab32a](https://github.com/graasp/graasp/commit/69ab32a29e2c6df61216892873394adeeb96ef47))
* **deps:** update dependency fastify to v5.7.3 [security] ([#2069](https://github.com/graasp/graasp/issues/2069)) ([4f2d703](https://github.com/graasp/graasp/commit/4f2d703025a1e4129ba9da5fb59681ab2dc2aa5d))
* fix copy for h5p with custom filename on upload ([#2071](https://github.com/graasp/graasp/issues/2071)) ([660272d](https://github.com/graasp/graasp/commit/660272d67b7ecbe979c82c918fb53be41d377bed))
* update umami tag to v3.0.3 ([#2072](https://github.com/graasp/graasp/issues/2072)) ([325ccc3](https://github.com/graasp/graasp/commit/325ccc3f3c1229d8e4d8c56b96d14295e8d7e25a))

## [2.12.0](https://github.com/graasp/graasp/compare/v2.11.0...v2.12.0) (2026-01-19)


### Features

* return bad credentials error ([#2049](https://github.com/graasp/graasp/issues/2049)) ([ad77bbf](https://github.com/graasp/graasp/commit/ad77bbfd695e9d4696986998d3edadbd521df169))
* return only deleted items up to 3 months ([#2048](https://github.com/graasp/graasp/issues/2048)) ([83bd4c4](https://github.com/graasp/graasp/commit/83bd4c4283a01d67f1ea96883e662cc043494e2f))


### Bug Fixes

* add bust-cache on dev startup ([#2055](https://github.com/graasp/graasp/issues/2055)) ([290710a](https://github.com/graasp/graasp/commit/290710af04928559d778847eab21fcb6d3e784d9))
* **deps:** upgrade node to v24.12 ([#2050](https://github.com/graasp/graasp/issues/2050)) ([1b36d09](https://github.com/graasp/graasp/commit/1b36d09be9e941e57ba70910a401576cf4262bfc))
* udpate to allow s3 errors as OK validations ([608b5d5](https://github.com/graasp/graasp/commit/608b5d513a0f03540af0c0f9a19e6ef3c45354e3))
* validation for thumbnails ([#2054](https://github.com/graasp/graasp/issues/2054)) ([608b5d5](https://github.com/graasp/graasp/commit/608b5d513a0f03540af0c0f9a19e6ef3c45354e3))

## [2.11.0](https://github.com/graasp/graasp/compare/v2.10.4...v2.11.0) (2025-12-18)


### Features

* add indexes to optimize item deletion ([#2046](https://github.com/graasp/graasp/issues/2046)) ([fd43e37](https://github.com/graasp/graasp/commit/fd43e37ffe4a6e8d63411a6d75dcb4cf0f06d211))
* add migration for index on item's deleted at ([#2045](https://github.com/graasp/graasp/issues/2045)) ([eefb250](https://github.com/graasp/graasp/commit/eefb25060ed180305912e1dbc85beff7a393e0af))


### Bug Fixes

* **deps:** update dependency nodemailer to v7.0.11 [security] ([#2041](https://github.com/graasp/graasp/issues/2041)) ([3e1edc7](https://github.com/graasp/graasp/commit/3e1edc7da82ca993b1fe566b2dbac600032b49eb))
* replace nginx proxy with caddy ([#2042](https://github.com/graasp/graasp/issues/2042)) ([8e5813a](https://github.com/graasp/graasp/commit/8e5813a9c65ad27c285204b9f004ef3a28b2ad50))

## [2.10.4](https://github.com/graasp/graasp/compare/v2.10.3...v2.10.4) (2025-11-28)


### Bug Fixes

* add H5P integration url to packed item wrapper ([#2027](https://github.com/graasp/graasp/issues/2027)) ([c0173e7](https://github.com/graasp/graasp/commit/c0173e75b26a04a8ef3d681ffd807bdaea795b40))
* add missing operationId for member action call ([#2033](https://github.com/graasp/graasp/issues/2033)) ([8ca72ed](https://github.com/graasp/graasp/commit/8ca72edfed7a69d8aafceaac433196f5f3c2a957))
* deploy to latest tag ([0ce5204](https://github.com/graasp/graasp/commit/0ce5204aa6f0bc84a0bebea15e077ea8f9edc977))
* expose with the /api prefix ([#2037](https://github.com/graasp/graasp/issues/2037)) ([dd56268](https://github.com/graasp/graasp/commit/dd562686a0dfb0f2a8414eae87297476046f8cbb))
* remove translations package in favor of sdk ([#2020](https://github.com/graasp/graasp/issues/2020)) ([67e8e8a](https://github.com/graasp/graasp/commit/67e8e8ae00207cda520bf17c72cc2a7c4ec5d551))
* send full url when requesting the short link ([#2025](https://github.com/graasp/graasp/issues/2025)) ([453b9f4](https://github.com/graasp/graasp/commit/453b9f43fd0c8b7f3fa296afc130b27ff341fc45))
* upgrade sdk ([67e8e8a](https://github.com/graasp/graasp/commit/67e8e8ae00207cda520bf17c72cc2a7c4ec5d551))
* upgrade sdk ([#2034](https://github.com/graasp/graasp/issues/2034)) ([b120bd2](https://github.com/graasp/graasp/commit/b120bd262e51158c4a1e378aab5b4d1c47029b3d))

## [2.10.3](https://github.com/graasp/graasp/compare/v2.10.2...v2.10.3) (2025-10-23)


### Bug Fixes

* optimise get app data with indexes ([#2018](https://github.com/graasp/graasp/issues/2018)) ([288b725](https://github.com/graasp/graasp/commit/288b725bbee6bb23ca3327806f7d4e4df3765548))
* return correct item reference for membership ([#2013](https://github.com/graasp/graasp/issues/2013)) ([7976925](https://github.com/graasp/graasp/commit/797692550bb6c6b56615054deb6938d90596e27f))

## [2.10.2](https://github.com/graasp/graasp/compare/v2.10.1...v2.10.2) (2025-10-20)

### Bug Fixes

* optimize get item parents ([#2005](https://github.com/graasp/graasp/issues/2005)) ([b5c5822](https://github.com/graasp/graasp/commit/b5c58223a3ab4271260df6593c74199dc8932742))

## [2.10.0](https://github.com/graasp/graasp/compare/v2.9.3...v2.10.0) (2025-10-17)


### Features

* **local-dev:** use garage for s3 ([#1996](https://github.com/graasp/graasp/issues/1996)) ([8873b7f](https://github.com/graasp/graasp/commit/8873b7f99882f68b2cd53d77844ad1fa6a96fa1d))
* return minimal item parent ([#2004](https://github.com/graasp/graasp/issues/2004)) ([2075906](https://github.com/graasp/graasp/commit/20759060047e011845510a21d3ae1c96f1d0eb5c))


### Bug Fixes

* add migration to insert migration from phoenix for planned migration ([#2011](https://github.com/graasp/graasp/issues/2011)) ([472ebfa](https://github.com/graasp/graasp/commit/472ebfa4e58f11d8afbfaa9502eb6de5e33b35ba))
* add thumbnails in search ([#2006](https://github.com/graasp/graasp/issues/2006)) ([65f9801](https://github.com/graasp/graasp/commit/65f980138c1004b195f4554a864eda8e82557727))
* upgrade openai to v6.3 ([#2007](https://github.com/graasp/graasp/issues/2007)) ([8856134](https://github.com/graasp/graasp/commit/88561341eb464dbd8f32b5f519aae6df449dc3ba))

## [2.9.3](https://github.com/graasp/graasp/compare/v2.9.2...v2.9.3) (2025-10-10)


### Bug Fixes

* allow the use of older gpt models in the api ([#2001](https://github.com/graasp/graasp/issues/2001)) ([9a9f63e](https://github.com/graasp/graasp/commit/9a9f63ea7a282b42a8678c381027e347e67b9fed))

## [2.9.2](https://github.com/graasp/graasp/compare/v2.9.1...v2.9.2) (2025-10-08)


### Bug Fixes

* add instruction related to nudenet pull issues ([#1993](https://github.com/graasp/graasp/issues/1993)) ([8b49cf0](https://github.com/graasp/graasp/commit/8b49cf0e3fc985a92414eabd515bd6e264b9304d))
* add item id in current guest itemloginSchema ([#1990](https://github.com/graasp/graasp/issues/1990)) ([4a64e55](https://github.com/graasp/graasp/commit/4a64e5510e87e1afbd0ab30b5161c9e4151c1409))
* **ci:** use an env var to mitigate input injection ([#1995](https://github.com/graasp/graasp/issues/1995)) ([b73fbe6](https://github.com/graasp/graasp/commit/b73fbe66c3a5404430b88487eb62187f075b9d6f))
* **deps:** update dependency nodemailer to v7 [security] ([#1998](https://github.com/graasp/graasp/issues/1998)) ([e8e5dc5](https://github.com/graasp/graasp/commit/e8e5dc5ba0a982ed08054a25268e9f440fb4f1f5))
* update with new GPT versions ([#1997](https://github.com/graasp/graasp/issues/1997)) ([2fdc706](https://github.com/graasp/graasp/commit/2fdc706117933e93587525fb752feb9b14662c41))

## [2.9.1](https://github.com/graasp/graasp/compare/v2.9.0...v2.9.1) (2025-09-12)


### Bug Fixes

* destroy document only on empty connections ([#1988](https://github.com/graasp/graasp/issues/1988)) ([272e6e1](https://github.com/graasp/graasp/commit/272e6e1b22921a9d749e842e6e03a503590b3e3d))

## [2.9.0](https://github.com/graasp/graasp/compare/v2.8.1...v2.9.0) (2025-09-12)


### Features

* add logs to pages ([#1979](https://github.com/graasp/graasp/issues/1979)) ([65dcd23](https://github.com/graasp/graasp/commit/65dcd23aed0b9bf682c5b723faff25904f33c021))


### Bug Fixes

* catch error when getting thumbnail ([#1977](https://github.com/graasp/graasp/issues/1977)) ([93eb419](https://github.com/graasp/graasp/commit/93eb419d5c3322012a02729e56bd802629da6ada))
* logout guest of deleted item and return itemLoginSchema in /current ([#1986](https://github.com/graasp/graasp/issues/1986)) ([19a75cd](https://github.com/graasp/graasp/commit/19a75cdac42bda28e723375677774c90ee0e0fff))
* remove AWS task defs ([#1981](https://github.com/graasp/graasp/issues/1981)) ([64b5538](https://github.com/graasp/graasp/commit/64b55381b1bd95780c5b18bd62817b1a72683de0))
* update nudenet to use latest release and control the classes that are inferred ([#1987](https://github.com/graasp/graasp/issues/1987)) ([628f19b](https://github.com/graasp/graasp/commit/628f19b842064b8594925bd24cc85a9f30c2c6fa))
* use arm build ([#1980](https://github.com/graasp/graasp/issues/1980)) ([17ff722](https://github.com/graasp/graasp/commit/17ff722743a0e7430dc234c32eaaeca274aec29e))

## [2.8.1](https://github.com/graasp/graasp/compare/v2.8.0...v2.8.1) (2025-09-04)


### Bug Fixes

* update to support admin schemas ([#1971](https://github.com/graasp/graasp/issues/1971)) ([b53e019](https://github.com/graasp/graasp/commit/b53e019dee6078621baefb0c9c29d49dd91e89af))

## [2.8.0](https://github.com/graasp/graasp/compare/v2.7.0...v2.8.0) (2025-08-28)


### Features

* add read ws ([#1967](https://github.com/graasp/graasp/issues/1967)) ([9f34803](https://github.com/graasp/graasp/commit/9f34803e1b1764f808aee4937da74f141f4a78fa))
* copy update on page copy ([#1969](https://github.com/graasp/graasp/issues/1969)) ([9d6eb5c](https://github.com/graasp/graasp/commit/9d6eb5cc83438a3a2f47aeac4ca15377f0e61f07))
* create page endpoint ([#1947](https://github.com/graasp/graasp/issues/1947)) ([a391280](https://github.com/graasp/graasp/commit/a391280be0dbd0aae5cb6425dce009b560c09362))
* **page:** gracefully fallback on error ([#1970](https://github.com/graasp/graasp/issues/1970)) ([6bca256](https://github.com/graasp/graasp/commit/6bca256282f4f84b75e2921702ff1ffd1853d883))
* save page updates ([#1965](https://github.com/graasp/graasp/issues/1965)) ([76a284d](https://github.com/graasp/graasp/commit/76a284d8f584014dd3b419a55726f660064c7258))
* setup yjs for collaboration in pages ([#1959](https://github.com/graasp/graasp/issues/1959)) ([d773276](https://github.com/graasp/graasp/commit/d773276a045a4c17df50e50f33a89adc88d0ffd1))


### Bug Fixes

* ensure required env var can't be an empty string ([#1960](https://github.com/graasp/graasp/issues/1960)) ([3ce0469](https://github.com/graasp/graasp/commit/3ce0469fe7ca54e978ec3da4e5047d3c8306706a))

## [2.7.0](https://github.com/graasp/graasp/compare/v2.6.0...v2.7.0) (2025-07-23)


### Features

* **password:** set login session in password login ([#1944](https://github.com/graasp/graasp/issues/1944)) ([b07c850](https://github.com/graasp/graasp/commit/b07c850d6dce7b99e0ab193b4f5b39c70b2a3018))


### Bug Fixes

* check admin permission on recycled items for deletion ([#1949](https://github.com/graasp/graasp/issues/1949)) ([63ce44f](https://github.com/graasp/graasp/commit/63ce44f059accfe36c6130d910f4c029d6567086))
* code smell with nested template string ([#1942](https://github.com/graasp/graasp/issues/1942)) ([2cb7732](https://github.com/graasp/graasp/commit/2cb77327c6431fc2e0a6a725c028cee3a8a1e3ed))
* **deps:** update dependency form-data to v4.0.4 [security] ([#1954](https://github.com/graasp/graasp/issues/1954)) ([3d436fd](https://github.com/graasp/graasp/commit/3d436fd9da5d02f66e6837a6dcc8f88988dd5dd3))
* improve get own recycled items with index ([#1955](https://github.com/graasp/graasp/issues/1955)) ([fbd872b](https://github.com/graasp/graasp/commit/fbd872ba61abc5894573c59ce45a30b3a4334ee5))
* **indexing:** throw only for unexpected error on getting index ([#1953](https://github.com/graasp/graasp/issues/1953)) ([9776242](https://github.com/graasp/graasp/commit/97762425b4867954dd3ca0ef2beb6ec33cc460fa))
* use `secure: true` instead of `smtps://` in mailer ([#1952](https://github.com/graasp/graasp/issues/1952)) ([03fec6c](https://github.com/graasp/graasp/commit/03fec6c1800ddb6a7c4e6394cd31d1d6421e9817))

## [2.6.0](https://github.com/graasp/graasp/compare/v2.5.1...v2.6.0) (2025-07-17)


### Features

* create build index worker ([#1928](https://github.com/graasp/graasp/issues/1928)) ([547611c](https://github.com/graasp/graasp/commit/547611cd9b20c6e1c9817e92f05445a344ac6787))
* optimize query for indexing items ([#1937](https://github.com/graasp/graasp/issues/1937)) ([a3a93a3](https://github.com/graasp/graasp/commit/a3a93a35c09b4714fe97544c70c388d987e68157))


### Bug Fixes

* lowercase the email when requesting an email change ([#1940](https://github.com/graasp/graasp/issues/1940)) ([dcef3c0](https://github.com/graasp/graasp/commit/dcef3c0bfcb7f56331da3f79a2dcde0e1a33cfd9))
* remove legacy push action to graasp-deploy ([#1933](https://github.com/graasp/graasp/issues/1933)) ([a0db759](https://github.com/graasp/graasp/commit/a0db75960946ecb71d7bc9b5290f6369d3501400))
* remove unused configuration and decoration for the file service ([#1934](https://github.com/graasp/graasp/issues/1934)) ([882b469](https://github.com/graasp/graasp/commit/882b469e381a87311e8a793fd7293ca67d64aba5))
* upgrade openai models ([#1918](https://github.com/graasp/graasp/issues/1918)) ([2937830](https://github.com/graasp/graasp/commit/2937830ffab8b56c9e5b1968842ad6cf922dc20c))

## [2.5.1](https://github.com/graasp/graasp/compare/v2.5.0...v2.5.1) (2025-06-30)


### Bug Fixes

* allow reader to download raw zip ([#1922](https://github.com/graasp/graasp/issues/1922)) ([df73cb9](https://github.com/graasp/graasp/commit/df73cb9ea459f3e4b0c23831adcb665bc1fa3806))
* fix schema ref id for generated client ([#1930](https://github.com/graasp/graasp/issues/1930)) ([7a11a39](https://github.com/graasp/graasp/commit/7a11a39499c3e52be486b77797d589872838d256))

## [2.5.0](https://github.com/graasp/graasp/compare/v2.4.0...v2.5.0) (2025-06-25)


### Features

* use yazl for export actions of items ([#1914](https://github.com/graasp/graasp/issues/1914)) ([e70e856](https://github.com/graasp/graasp/commit/e70e856b3cc2a4200948d8514355d2e5314d8078))
* workers for export item as zip (import export refactor) ([#1891](https://github.com/graasp/graasp/issues/1891)) ([a69948d](https://github.com/graasp/graasp/commit/a69948d3cbb9e51e54bfc26ae9abba7df1ae674b))


### Bug Fixes

* action.view migration to remove `explorer` and add `home` and `analytics` ([#1920](https://github.com/graasp/graasp/issues/1920)) ([bea9a5a](https://github.com/graasp/graasp/commit/bea9a5a27717f568dc6a138160af639a38d4ee2e))
* add strict facetName schema from filterable attributes ([#1919](https://github.com/graasp/graasp/issues/1919)) ([6ddfb7a](https://github.com/graasp/graasp/commit/6ddfb7a4e6e232ffaadad3513c546d08c3885949))
* add test for app origin url format ([#1910](https://github.com/graasp/graasp/issues/1910)) ([35da7fa](https://github.com/graasp/graasp/commit/35da7facc4d8819015a7a60b8e5a087c795ffee7))
* change download file schema ([#1912](https://github.com/graasp/graasp/issues/1912)) ([b2e59c7](https://github.com/graasp/graasp/commit/b2e59c7d6d37229508ef428e086ca7180df0d742))
* **deps:** update dependency @fastify/swagger to v9.5.1 ([#1885](https://github.com/graasp/graasp/issues/1885)) ([c037226](https://github.com/graasp/graasp/commit/c03722693c45a9d5985e7deaf31b220147d7d7f6))
* **deps:** update dependency fastify to v5.3.3 ([#1886](https://github.com/graasp/graasp/issues/1886)) ([4aa8219](https://github.com/graasp/graasp/commit/4aa821937a6028fe6df0d31e009e36407e6153e7))
* **deps:** update dependency ioredis to v5.6.1 ([#1852](https://github.com/graasp/graasp/issues/1852)) ([cc1a53c](https://github.com/graasp/graasp/commit/cc1a53c880b98e44380cf5a05ee839ed127853df))
* **deps:** update dependency nodemailer to v6.10.1 ([#1853](https://github.com/graasp/graasp/issues/1853)) ([7ab6cc3](https://github.com/graasp/graasp/commit/7ab6cc3fb17280c5179c06e948d0374544f9d662))
* display thumbnail failure reason as JSON.stringified ([#1903](https://github.com/graasp/graasp/issues/1903)) ([81f8d4b](https://github.com/graasp/graasp/commit/81f8d4bcc216723e4d431b2f520f9d677d82b6e8))
* prepare changes for ESM use verbatimSyntax ([#1896](https://github.com/graasp/graasp/issues/1896)) ([311f8e1](https://github.com/graasp/graasp/commit/311f8e124e8d4695825cb8658b61f679173f650a))
* rebuild meilisearch settings after index ([#1917](https://github.com/graasp/graasp/issues/1917)) ([a158562](https://github.com/graasp/graasp/commit/a1585629d51c1afa0f104bb15ff4f3d7d4e94626))
* **refactor:** simplify environment variables ([#1897](https://github.com/graasp/graasp/issues/1897)) ([041bcab](https://github.com/graasp/graasp/commit/041bcab7a8ffc6ab14999b9e3fa07df812f5c044))
* sanitize original order before copy ([#1913](https://github.com/graasp/graasp/issues/1913)) ([b73d57a](https://github.com/graasp/graasp/commit/b73d57aa63bb1816b692f29a3958a7a755320fd4))
* some typo in the readme ([#1894](https://github.com/graasp/graasp/issues/1894)) ([e7ea9be](https://github.com/graasp/graasp/commit/e7ea9beb0f48a0b4f2ed9c36333683aa6355a0db))
* use hitsPerPage in search ([#1916](https://github.com/graasp/graasp/issues/1916)) ([d554c01](https://github.com/graasp/graasp/commit/d554c01b456867a7a60619c53a45a50c4c519b1e))
* use pipeline instead of pipe ([#1906](https://github.com/graasp/graasp/issues/1906)) ([3e29d47](https://github.com/graasp/graasp/commit/3e29d47a797123050d7ffd5a03976b9c03fe072f))
* use yazl for member export data ([#1911](https://github.com/graasp/graasp/issues/1911)) ([2dcf733](https://github.com/graasp/graasp/commit/2dcf733ec12258575c5108f86e8f1d37531994c0))

## [2.4.0](https://github.com/graasp/graasp/compare/v2.3.0...v2.4.0) (2025-06-05)


### Features

* **graasp-export:** import and export the APP items ([#1877](https://github.com/graasp/graasp/issues/1877)) ([feafca6](https://github.com/graasp/graasp/commit/feafca6cf28987eeaf786d83f2e6e1b13ca1ddc8))
* **graasp-import:** export and import the item thumbnails ([#1868](https://github.com/graasp/graasp/issues/1868)) ([0c0eb5a](https://github.com/graasp/graasp/commit/0c0eb5a82ca1766be6f7d84d992510eed67453e2))
* move membership endpoints ([#1873](https://github.com/graasp/graasp/issues/1873)) ([72a2aba](https://github.com/graasp/graasp/commit/72a2abac820ae9103c86baedc4f20e785ff5bbac))
* send email for export raw ([#1881](https://github.com/graasp/graasp/issues/1881)) ([5a1d3e4](https://github.com/graasp/graasp/commit/5a1d3e43f3d97ec2134e5c3f76edf2e753c8d46a))


### Bug Fixes

* add endpoint for featured collections ([#1883](https://github.com/graasp/graasp/issues/1883)) ([2823b78](https://github.com/graasp/graasp/commit/2823b784642adf0e45dfbfe75013c41f619c6ccc))
* allow to post twice a like on an item ([#1864](https://github.com/graasp/graasp/issues/1864)) ([b5b2180](https://github.com/graasp/graasp/commit/b5b21807e3d78f328bfcf1086b1c67d24ad6311d))
* **files-upload:** return simple error if exists ([#1866](https://github.com/graasp/graasp/issues/1866)) ([9c48b77](https://github.com/graasp/graasp/commit/9c48b7745cfd6af5686381933271d5a22726955a))
* improve schemas for item_packed.thumbnails and search hits ([#1869](https://github.com/graasp/graasp/issues/1869)) ([5f33206](https://github.com/graasp/graasp/commit/5f332062f913e301a96bc03fdfd54994f2add9a0))
* on save organize imports ([#1888](https://github.com/graasp/graasp/issues/1888)) ([6de5039](https://github.com/graasp/graasp/commit/6de5039c465dc1258cc348f6d45ba41ead67ec09))
* **opti:** remove join on accountsTable for `getInheritedMany` ([#1890](https://github.com/graasp/graasp/issues/1890)) ([5202de9](https://github.com/graasp/graasp/commit/5202de9f0805167b863be3225cdf27e3eeff9f93))
* use hostnames instead of container names ([#1880](https://github.com/graasp/graasp/issues/1880)) ([db1acb0](https://github.com/graasp/graasp/commit/db1acb06163700b1f97a07dad0d0db8da10375d5))

## [2.3.0](https://github.com/graasp/graasp/compare/v2.2.1...v2.3.0) (2025-05-05)

### Features

* unify file type ([#1840](https://github.com/graasp/graasp/issues/1840)) ([15dde54](https://github.com/graasp/graasp/commit/15dde54d9eda39e4792ee2ac61f658859b2de5fc))
  * `s3File` references become all `file`. Few existing `localFile` references also become `file`. This change impacts item files, app data (files) and app settings (file)
  * add `FILE_STORAGE_TYPE` environment variable being equal to `s3` or `local`.
  * remove `S3_FILE_ITEM_PLUGIN`.
  * change possible options for `H5P_FILE_STORAGE_TYPE` to `s3` or `local`.


### Bug Fixes

* allow guests to access etherpad ([#1861](https://github.com/graasp/graasp/issues/1861)) ([1eeec20](https://github.com/graasp/graasp/commit/1eeec20a0b0e11b16416e5728fdf5a3a198849f6))
* **dep:** remove `tsx` ([#1851](https://github.com/graasp/graasp/issues/1851)) ([f271c5d](https://github.com/graasp/graasp/commit/f271c5de50b4c4d35404642701e77d2af122da6f))

## [2.2.1](https://github.com/graasp/graasp/compare/v2.2.0...v2.2.1) (2025-05-01)


### Bug Fixes

* allow cors for patch, put and delete ([#1856](https://github.com/graasp/graasp/issues/1856)) ([b6060b9](https://github.com/graasp/graasp/commit/b6060b965020435efdaeb5956af82ebe02343bc5))
* auto-deploy ([#1835](https://github.com/graasp/graasp/issues/1835)) ([8ead8db](https://github.com/graasp/graasp/commit/8ead8db90c55b994e5c39bc00893d6c3298de814))

## [2.2.0](https://github.com/graasp/graasp/compare/v2.1.0...v2.2.0) (2025-04-30)


### Features

* add get maintenance endpoint ([#1845](https://github.com/graasp/graasp/issues/1845)) ([9372106](https://github.com/graasp/graasp/commit/9372106c101f7d3dc173ec8296f9555c49830d85))

## [2.1.0](https://github.com/graasp/graasp/compare/v2.0.3...v2.1.0) (2025-04-30)


### Features

* remove resultOf from item repository get many ([#1839](https://github.com/graasp/graasp/issues/1839)) ([fdc84f7](https://github.com/graasp/graasp/commit/fdc84f7e4beb3df6484edd0e639e588f9c5397d6))


### Bug Fixes

* **dev-container:** fix the init.sql file volume ([#1844](https://github.com/graasp/graasp/issues/1844)) ([0c53bbb](https://github.com/graasp/graasp/commit/0c53bbb2ae26592a0591c35003461908b0bb444a))
* **item-reorder:** wait for reorder to throw ([#1833](https://github.com/graasp/graasp/issues/1833)) ([a6957fd](https://github.com/graasp/graasp/commit/a6957fdaa7bdf4e4bd381910652a353c0d92eb83))
* setup init script ([#1774](https://github.com/graasp/graasp/issues/1774)) ([cbfb80a](https://github.com/graasp/graasp/commit/cbfb80a6f57198b49c2af485023aef9c5462a49f))
* upgrade fastify v5 ([#1816](https://github.com/graasp/graasp/issues/1816)) ([24d36b8](https://github.com/graasp/graasp/commit/24d36b858085c0dc8cd4266110f56a2b8752bb44))

## [2.0.3](https://github.com/graasp/graasp/compare/v2.0.2...v2.0.3) (2025-04-24)


### Bug Fixes

* read replica env vars ([#1836](https://github.com/graasp/graasp/issues/1836)) ([8c6add2](https://github.com/graasp/graasp/commit/8c6add26f8c2b85325874e01835644268fa7ea81))

## [2.0.2](https://github.com/graasp/graasp/compare/v2.0.1...v2.0.2) (2025-04-24)


### Bug Fixes

* **deps:** update aws-sdk-js-v3 monorepo to v3.787.0 ([#1702](https://github.com/graasp/graasp/issues/1702)) ([5396a8e](https://github.com/graasp/graasp/commit/5396a8e354f8846c5b88607713ada8814ae81a20))

## [2.0.1](https://github.com/graasp/graasp/compare/v2.0.0...v2.0.1) (2025-04-24)


### Bug Fixes

* add id-token permission in release-please workflow ([eeec1e8](https://github.com/graasp/graasp/commit/eeec1e825f9d0a6dbe174c655797b27a65ba0a26))
* convert timestamp columns to include timezone ([#1830](https://github.com/graasp/graasp/issues/1830)) ([a79b234](https://github.com/graasp/graasp/commit/a79b234f137170201cda48a631ec225fa657b7b5))
* **export-actions:** use timestamp for filenames, infer zip ([#1828](https://github.com/graasp/graasp/issues/1828)) ([0ed2f46](https://github.com/graasp/graasp/commit/0ed2f4668f97ff1ca9466d2bca79aadddae2c14a))

## [2.0.0](https://github.com/graasp/graasp/compare/v1.65.2...v2.0.0) (2025-04-23)


### Features

* drizzleORM migration ([#1804](https://github.com/graasp/graasp/issues/1804)) ([6231c38](https://github.com/graasp/graasp/commit/6231c38681b4f3232b00796b1ce9a23a7b4aa65b))
* **graasp-export:** export in graasp format ([#1796](https://github.com/graasp/graasp/issues/1796)) ([37eab43](https://github.com/graasp/graasp/commit/37eab43dcd262682f8b78de3d41c398bb6bbd252))
* return no content for no item login schema ([#1821](https://github.com/graasp/graasp/issues/1821)) ([5881041](https://github.com/graasp/graasp/commit/5881041db1eb9d57c83ecd0e02d9098c8b089c05))


### Bug Fixes

* add index on path with deleted_at condition ([#1812](https://github.com/graasp/graasp/issues/1812)) ([2bef3cd](https://github.com/graasp/graasp/commit/2bef3cda42c25a934295572d5942d30d5a559a66))
* add member prod to app data ([#1811](https://github.com/graasp/graasp/issues/1811)) ([1c75cd8](https://github.com/graasp/graasp/commit/1c75cd8c9f64ac4ecbd1362d328ae51e5ee13154))
* copy app settings on item copy ([#1819](https://github.com/graasp/graasp/issues/1819)) ([efa82b6](https://github.com/graasp/graasp/commit/efa82b68499cd0cdfe5dfaa480fed22f2ebf9e93))
* docker arg into later stage ([#1820](https://github.com/graasp/graasp/issues/1820)) ([7fb23f7](https://github.com/graasp/graasp/commit/7fb23f79729ee5d17c8d0be7391f0c82d1b1cd64))
* fix action export and improve download name ([#1822](https://github.com/graasp/graasp/issues/1822)) ([8078614](https://github.com/graasp/graasp/commit/8078614de1a603993f4a348d5ca9993a9c38f494))
* rename tag repository files ([f72bf18](https://github.com/graasp/graasp/commit/f72bf184262c4d761b657421f4b76233a6e41fa4))
* tag rename ([186ef1a](https://github.com/graasp/graasp/commit/186ef1a099e7366cd85cec1959b535a39e175032))
* update readme ([#1818](https://github.com/graasp/graasp/issues/1818)) ([2842fbe](https://github.com/graasp/graasp/commit/2842fbe2632484c210a8484c385b4a26ffb0df94))
* update sdk ([f669fca](https://github.com/graasp/graasp/commit/f669fcaa77121276cc98fd2bec309f8b3a290fed))
* workflows ([#1813](https://github.com/graasp/graasp/issues/1813)) ([033758f](https://github.com/graasp/graasp/commit/033758f9ff7bf6d29837f1e3e75f0b684f593fea))

## [1.65.2](https://github.com/graasp/graasp/compare/v1.65.1...v1.65.2) (2025-03-17)


### Bug Fixes

* fix request membership link in email ([#1789](https://github.com/graasp/graasp/issues/1789)) ([d388623](https://github.com/graasp/graasp/commit/d388623cd8ccbec07b19e5c00e9bd6897026880a))

## [1.65.1](https://github.com/graasp/graasp/compare/v1.65.0...v1.65.1) (2025-03-14)


### Bug Fixes

* return deleted child items in own recycled ([#1790](https://github.com/graasp/graasp/issues/1790)) ([477d6b6](https://github.com/graasp/graasp/commit/477d6b6fcdf164c45c0873878812110bdd6a0d35))

## [1.65.0](https://github.com/graasp/graasp/compare/v1.64.0...v1.65.0) (2025-03-10)


### Features

* **file-upload:** add the possibility to delete and upload many files ([#1786](https://github.com/graasp/graasp/issues/1786)) ([3f75867](https://github.com/graasp/graasp/commit/3f75867b7032db814c41644b5f86815e322b75f1))


### Bug Fixes

* **file:** keep extension on copy, remove content-disposition and cache control ([#1785](https://github.com/graasp/graasp/issues/1785)) ([1fa4202](https://github.com/graasp/graasp/commit/1fa4202566239076a8b8290591aa1a0a527cd3c9))

## [1.64.0](https://github.com/graasp/graasp/compare/v1.63.0...v1.64.0) (2025-03-03)


### Features

* add patch file ([#1762](https://github.com/graasp/graasp/issues/1762)) ([a15b911](https://github.com/graasp/graasp/commit/a15b911298f05a67cb35427597f2266570e31aeb))
* **etherpad:** allow readerPermission on create, item props in update ([#1780](https://github.com/graasp/graasp/issues/1780)) ([13645e0](https://github.com/graasp/graasp/commit/13645e0fc97a8520fc0fc3a3dc1426223c4b8dfb))
* **item:** add postMany and refactor post ([#1765](https://github.com/graasp/graasp/issues/1765)) ([aad8c9a](https://github.com/graasp/graasp/commit/aad8c9aecccf72a8770a566ab3c06a92ecec0430))


### Bug Fixes

* allow link settings to be patched ([#1770](https://github.com/graasp/graasp/issues/1770)) ([8fdcb9d](https://github.com/graasp/graasp/commit/8fdcb9daf6e733fdb20d4643f5f4219858130a15))

## [1.63.0](https://github.com/graasp/graasp/compare/v1.62.0...v1.63.0) (2025-02-18)


### Features

* redirect to home ([#1756](https://github.com/graasp/graasp/issues/1756)) ([33d6f0e](https://github.com/graasp/graasp/commit/33d6f0ee5650c90123423594eb7349a388beb148))


### Bug Fixes

* add inclusive text for french ([#1753](https://github.com/graasp/graasp/issues/1753)) ([cbdfcf3](https://github.com/graasp/graasp/commit/cbdfcf32f6d58ceb2c5c375511e27677995b71ba))

## [1.62.0](https://github.com/graasp/graasp/compare/v1.61.0...v1.62.0) (2025-02-06)


### Features

* add app endpoints ([#1730](https://github.com/graasp/graasp/issues/1730)) ([909df1a](https://github.com/graasp/graasp/commit/909df1aa64c8501c40cf43e620b3e6439a9976a1))
* add endpoints for shortcut ([#1732](https://github.com/graasp/graasp/issues/1732)) ([5208eb0](https://github.com/graasp/graasp/commit/5208eb01391ab48003b3d2afc0852d98684ab7a2))
* add likes in meilisearch ([#1715](https://github.com/graasp/graasp/issues/1715)) ([6148bfa](https://github.com/graasp/graasp/commit/6148bfaa24ff0ecfb6073fecbef1df08ed415ced))
* allow readers to edit etherpad ([#1713](https://github.com/graasp/graasp/issues/1713)) ([09c0d64](https://github.com/graasp/graasp/commit/09c0d644e1d917a7b772317c36d64a770fea335c))
* improve schemas for item validation ([#1724](https://github.com/graasp/graasp/issues/1724)) ([b975671](https://github.com/graasp/graasp/commit/b97567176f4b9c5789cc1c3780dd0f221448593f))
* **published-search:** allow creator id filter ([#1720](https://github.com/graasp/graasp/issues/1720)) ([9097c82](https://github.com/graasp/graasp/commit/9097c8253c774cfe113a457f31dd79beecd3536d))
* remove unnecessary host variables ([#1738](https://github.com/graasp/graasp/issues/1738)) ([4ab71b7](https://github.com/graasp/graasp/commit/4ab71b72bf6eb5a5ae07cd502bde574b72d56afd))
* return null for no thumbnail items ([#1727](https://github.com/graasp/graasp/issues/1727)) ([b7c8036](https://github.com/graasp/graasp/commit/b7c8036849f7d4a5682007ac07a3e4130f56b65b))
* update get liked collections with meilisearch ([#1717](https://github.com/graasp/graasp/issues/1717)) ([58bd1f2](https://github.com/graasp/graasp/commit/58bd1f2c09a83a66e909cdb6bfbff73f60a237f0))
* update recent endpoint to use meilisearch ([#1722](https://github.com/graasp/graasp/issues/1722)) ([eb76b1b](https://github.com/graasp/graasp/commit/eb76b1b546b08a8b1576a3560cb4d284c36b9719))


### Bug Fixes

* apply rightsizing recomandations ([#1741](https://github.com/graasp/graasp/issues/1741)) ([a12a6ef](https://github.com/graasp/graasp/commit/a12a6ef37deb275cd727ae4a5d7f319a7bfc0ebc))
* fix schema typos ([#1734](https://github.com/graasp/graasp/issues/1734)) ([afedc3a](https://github.com/graasp/graasp/commit/afedc3af2f79a5f121439988387f5ea294ed06bd))
* remove default sorting for search ([#1733](https://github.com/graasp/graasp/issues/1733)) ([d96f7e0](https://github.com/graasp/graasp/commit/d96f7e08089d3c927ff2f0b7d6822666c13ae93d))
* replace non breaking spaces from link metadata title ([#1745](https://github.com/graasp/graasp/issues/1745)) ([be6ed25](https://github.com/graasp/graasp/commit/be6ed25c55415dcb9ce6777fb855686064b688aa))
* return 200 and null for empty member profile ([#1736](https://github.com/graasp/graasp/issues/1736)) ([5674cb7](https://github.com/graasp/graasp/commit/5674cb7942e5688217f0d7e0033199134331ed94))
* **seed:** seed from json data ([#1728](https://github.com/graasp/graasp/issues/1728)) ([ae674e2](https://github.com/graasp/graasp/commit/ae674e24dfb75cf83a6fd5fe7981e1dee36b1025))

## [1.61.0](https://github.com/graasp/graasp/compare/v1.60.0...v1.61.0) (2025-01-08)


### Features

* add document endpoints ([#1711](https://github.com/graasp/graasp/issues/1711)) ([6d73b60](https://github.com/graasp/graasp/commit/6d73b6028097e2e614a3b608161a51627f1188b7))
* add post and patch links ([#1696](https://github.com/graasp/graasp/issues/1696)) ([13a67d5](https://github.com/graasp/graasp/commit/13a67d529e579b75e0c55d17d32df0d57e8c0298))
* update dependencies ([#1687](https://github.com/graasp/graasp/issues/1687)) ([c0df107](https://github.com/graasp/graasp/commit/c0df10728d97fbe01dcd7035a5d23a2fbbf0734a))
* update schemas, remove most additionalProperties false ([#1690](https://github.com/graasp/graasp/issues/1690)) ([89e39a2](https://github.com/graasp/graasp/commit/89e39a2c1e42472e757ea9392d853bc88ff2fabb))


### Bug Fixes

* add migration for downgrading guest memberships ([#1707](https://github.com/graasp/graasp/issues/1707)) ([5d3e48d](https://github.com/graasp/graasp/commit/5d3e48d78ce31db7ab0a919a903ea76e38fd00d3))
* analytics query schema error ([#1703](https://github.com/graasp/graasp/issues/1703)) ([7729fc6](https://github.com/graasp/graasp/commit/7729fc6c00057d20f73ebeccd4262c853c65eaa1))
* fix tests ([#1705](https://github.com/graasp/graasp/issues/1705)) ([bcb20d0](https://github.com/graasp/graasp/commit/bcb20d09dca3aeb7a0f5d43be9e4076471d4fbc8))
* update facet settings after rebuild ([#1712](https://github.com/graasp/graasp/issues/1712)) ([cd50e7f](https://github.com/graasp/graasp/commit/cd50e7fd51a775e7e896d5e8334b1f8eecfa80c3))

## [1.60.0](https://github.com/graasp/graasp/compare/v1.59.0...v1.60.0) (2024-12-13)


### Features

* add post and patch item folder ([#1625](https://github.com/graasp/graasp/issues/1625)) ([8ade6e8](https://github.com/graasp/graasp/commit/8ade6e819806e1f12a1f752c960f76c6a195bb30))
* integrate tags to meilisearch, remove categories, migration ([#1665](https://github.com/graasp/graasp/issues/1665)) ([c0c978b](https://github.com/graasp/graasp/commit/c0c978b5e566e2d944854557f9a0f8f710dda778))


### Bug Fixes

* add item in app action ([#1681](https://github.com/graasp/graasp/issues/1681)) ([d726491](https://github.com/graasp/graasp/commit/d726491f7b690a440939a525e7468c7527062dce))
* remove deprecated values for cc licenses ([#1678](https://github.com/graasp/graasp/issues/1678)) ([6d61341](https://github.com/graasp/graasp/commit/6d6134123f069d58e00e2c6eff3c70e78fb2929a))
* return no content for no avatar ([#1679](https://github.com/graasp/graasp/issues/1679)) ([baafaa5](https://github.com/graasp/graasp/commit/baafaa552892bef0fc4b92939b97b01a4b8654ff))

## [1.59.0](https://github.com/graasp/graasp/compare/v1.58.0...v1.59.0) (2024-12-10)


### Features

* add delete item login schema ([#1658](https://github.com/graasp/graasp/issues/1658)) ([fef252b](https://github.com/graasp/graasp/commit/fef252b3a4afb5a83a6711262a435e3e409899e2))
* add tag count search ([#1651](https://github.com/graasp/graasp/issues/1651)) ([ffc51e1](https://github.com/graasp/graasp/commit/ffc51e14f2ac7d52c9f71c8a8268a5caf140d53a))
* remove display name ([#1674](https://github.com/graasp/graasp/issues/1674)) ([7173c0c](https://github.com/graasp/graasp/commit/7173c0cffd5f57d4d3b4119f5363ce53c6b2a6fc))


### Bug Fixes

* add transaction around the createEtherPadItem to fix error 500 ([#1667](https://github.com/graasp/graasp/issues/1667)) ([b4cda5e](https://github.com/graasp/graasp/commit/b4cda5e5d1c9f132184ec0191c657948ade4a879))
* allow undefined `previousItemId` ([#1660](https://github.com/graasp/graasp/issues/1660)) ([3659cba](https://github.com/graasp/graasp/commit/3659cba1b0e9ff4beea29d30e6a6dd27d1f7bab9))
* file id error ([#1663](https://github.com/graasp/graasp/issues/1663)) ([54287a2](https://github.com/graasp/graasp/commit/54287a27d39457fbb2707d01e9043bc76e83dc61))
* sanitize html on upload and import ([#1653](https://github.com/graasp/graasp/issues/1653)) ([46abaa6](https://github.com/graasp/graasp/commit/46abaa65a3de20437fd50108a87f418496af6b14))
* use lower limit for consecutive exports ([#1664](https://github.com/graasp/graasp/issues/1664)) ([35fe733](https://github.com/graasp/graasp/commit/35fe7334f49bf2c8766d36aac045e62515d99277))
* use member username format from sdk ([#1656](https://github.com/graasp/graasp/issues/1656)) ([0a615af](https://github.com/graasp/graasp/commit/0a615afacc37e08bf478bc7a8b3d37dd3d90b359))

## [1.58.0](https://github.com/graasp/graasp/compare/v1.57.0...v1.58.0) (2024-11-20)


### Features

* add delete tag for item ([#1645](https://github.com/graasp/graasp/issues/1645)) ([e96c358](https://github.com/graasp/graasp/commit/e96c35833aa05e053932f21792724d0807259990))
* **file-upload:** identify and treat the H5P files in the general file upload ([#1631](https://github.com/graasp/graasp/issues/1631)) ([212bf92](https://github.com/graasp/graasp/commit/212bf92f92883046dc8a9365f88842ce47b266e8))
* implement create tag for item ([#1641](https://github.com/graasp/graasp/issues/1641)) ([24a9eb2](https://github.com/graasp/graasp/commit/24a9eb2b466d41fecbd4039fdbb10d50baf34bea))


### Bug Fixes

* add documentation and details to published schemas ([#1642](https://github.com/graasp/graasp/issues/1642)) ([6c9433a](https://github.com/graasp/graasp/commit/6c9433aae7abb719618d3b87a1db93724aed145a))
* fix tests ([#1646](https://github.com/graasp/graasp/issues/1646)) ([e7dc5b5](https://github.com/graasp/graasp/commit/e7dc5b5e4a89e2939e9c82a6e959ca674d264553))

## [1.57.0](https://github.com/graasp/graasp/compare/v1.56.1...v1.57.0) (2024-11-12)


### Features

* add tag and item to tag entities ([#1611](https://github.com/graasp/graasp/issues/1611)) ([1981576](https://github.com/graasp/graasp/commit/1981576d1473e0b6833fa7c84c78b3a91f6aa526))
* add temperature in query params for chatbot API ([#1628](https://github.com/graasp/graasp/issues/1628)) ([6adf661](https://github.com/graasp/graasp/commit/6adf661211c617d32e97526ba993c739637a7855))
* get item tags ([#1632](https://github.com/graasp/graasp/issues/1632)) ([33a9cb2](https://github.com/graasp/graasp/commit/33a9cb2fd9480755d51ef28db5ab0822e04bdd57))
* **refactor:** simplify the short links by using new SDK types ([#1612](https://github.com/graasp/graasp/issues/1612)) ([4a9c365](https://github.com/graasp/graasp/commit/4a9c365b6c2b2c68bb10ed7cdae9a129389178be))
* rename item tag to item visibility ([#1615](https://github.com/graasp/graasp/issues/1615)) ([91439c2](https://github.com/graasp/graasp/commit/91439c2a25674487c3bc4ace4ca5d92a9fe4ce18))


### Bug Fixes

* fix password reset email content ([#1619](https://github.com/graasp/graasp/issues/1619)) ([7c6ab79](https://github.com/graasp/graasp/commit/7c6ab7974060dd3fd3e1ba81f8607a355fe2fa92))

## [1.56.1](https://github.com/graasp/graasp/compare/v1.56.0...v1.56.1) (2024-11-04)


### Bug Fixes
* Optimize slow GET own recycled items [1594](https://github.com/graasp/graasp/commit/1b9c3651c58b47c365492ec0ff996423aeed23c7)
* **arabic:** update membership request translations ([#1605](https://github.com/graasp/graasp/issues/1605)) ([02ab379](https://github.com/graasp/graasp/commit/02ab379dca03e50271f59a18c6cd68c16f1ae99e))
* **german:** update translations ([#1602](https://github.com/graasp/graasp/issues/1602)) ([bb4ce03](https://github.com/graasp/graasp/commit/bb4ce03a4b9476cee8321b23db6291da2f928439))
* **italian:** update membership request translations ([#1603](https://github.com/graasp/graasp/issues/1603)) ([aefa15b](https://github.com/graasp/graasp/commit/aefa15b75461aeb594ca1cbb7de735d6c31316e6))
* **spanish:** update membership request translations ([#1604](https://github.com/graasp/graasp/issues/1604)) ([9a8ae46](https://github.com/graasp/graasp/commit/9a8ae4685dafed6b468461f5d0ad5c8d3b2d32a8))

## [1.56.0](https://github.com/graasp/graasp/compare/v1.55.0...v1.56.0) (2024-10-30)


### Features

* add migration from item category to item lang ([#1567](https://github.com/graasp/graasp/issues/1567)) ([dcff750](https://github.com/graasp/graasp/commit/dcff750995ad0501ccd7ffe38deea62588f78938))

## [1.55.0](https://github.com/graasp/graasp/compare/v1.54.2...v1.55.0) (2024-10-29)


### Features

* add health endpoint ([#1576](https://github.com/graasp/graasp/issues/1576)) ([7e4bfd7](https://github.com/graasp/graasp/commit/7e4bfd74828bb6702489dfcc99c788870902c7cd))
* add item lang in meilisearch index ([#1565](https://github.com/graasp/graasp/issues/1565)) ([bb467a5](https://github.com/graasp/graasp/commit/bb467a5909e94bb5d7f7e0a6e99403ae35b69fb6))
* lint openapi during git actions ([#1527](https://github.com/graasp/graasp/issues/1527)) ([c507153](https://github.com/graasp/graasp/commit/c507153219389649b4a601c853e4c6d9a4361d9b))
* remove GET tags endpoints ([#1557](https://github.com/graasp/graasp/issues/1557)) ([fd01d45](https://github.com/graasp/graasp/commit/fd01d453d8259da5d9a85738cdd68bfc92e7da4f))
* split upload csv ([#1561](https://github.com/graasp/graasp/issues/1561)) ([2daf09e](https://github.com/graasp/graasp/commit/2daf09e1a5b8c10a86831d80a61d2f57259a106a))


### Bug Fixes

* add env var for account ([#1578](https://github.com/graasp/graasp/issues/1578)) ([04a6bee](https://github.com/graasp/graasp/commit/04a6bee13cf03605c2c1b5fac81e611fa798ff32))
* add optional param for actions ([#1562](https://github.com/graasp/graasp/issues/1562)) ([e52f1aa](https://github.com/graasp/graasp/commit/e52f1aabf04f39cb038ef4e38a8ac41e6ee8f9b5))
* allow local file in update schema ([#1570](https://github.com/graasp/graasp/issues/1570)) ([85b5ff1](https://github.com/graasp/graasp/commit/85b5ff17167f2daebf274529be75fcb509888c15))
* does not check password format on password login ([#1574](https://github.com/graasp/graasp/issues/1574)) ([bba91ed](https://github.com/graasp/graasp/commit/bba91edb587fad2e518f6d214e0eac3cb5e30736))
* fix packed tag ([#1552](https://github.com/graasp/graasp/issues/1552)) ([6fd9910](https://github.com/graasp/graasp/commit/6fd9910f2ece88e75285e8649dbeff27cc269241))
* new email builder and title escape fix ([#1289](https://github.com/graasp/graasp/issues/1289)) ([4dce241](https://github.com/graasp/graasp/commit/4dce241796c878d816adfba88ec66c0d6e88a3a1))
* put nudenet back in container ([#1558](https://github.com/graasp/graasp/issues/1558)) ([d502058](https://github.com/graasp/graasp/commit/d5020582cc756a5d1c84a5fae472516d8cbaaf7a))
* setup single db instance ([#1575](https://github.com/graasp/graasp/issues/1575)) ([bf8e86a](https://github.com/graasp/graasp/commit/bf8e86a7690e2d1e52904706886c3c86d5b5b728))

## [1.54.2](https://github.com/graasp/graasp/compare/v1.54.1...v1.54.2) (2024-10-21)


### Bug Fixes

* allow guests in members app context, allow to get context as guest ([#1554](https://github.com/graasp/graasp/issues/1554)) ([0ef4047](https://github.com/graasp/graasp/commit/0ef4047cbf92df89057b0eed1a5bcbda55abcfb4))

## [1.54.1](https://github.com/graasp/graasp/compare/v1.54.0...v1.54.1) (2024-10-18)


### Bug Fixes

* set html as optional for link metadata ([#1546](https://github.com/graasp/graasp/issues/1546)) ([1d87bce](https://github.com/graasp/graasp/commit/1d87bceb9f4ee81b3d4bbc61ef1b029c50a7dce1))
* update schema for current account ([#1542](https://github.com/graasp/graasp/issues/1542)) ([417f397](https://github.com/graasp/graasp/commit/417f397bd235ef6e3bc818f20cabc40d50ffc00a))

## [1.54.0](https://github.com/graasp/graasp/compare/v1.53.1...v1.54.0) (2024-10-18)


### Features

* custom type strict object ([#1540](https://github.com/graasp/graasp/issues/1540)) ([eba0475](https://github.com/graasp/graasp/commit/eba047573d170fe3fb616e0c593c95151faef85f))
* remove packed from own recycled, add pagination ([#1446](https://github.com/graasp/graasp/issues/1446)) ([25abbae](https://github.com/graasp/graasp/commit/25abbae3564dc9ddd86e872240802ad790f7a119))
* save last authenticated for guest ([#1539](https://github.com/graasp/graasp/issues/1539)) ([f84e920](https://github.com/graasp/graasp/commit/f84e920f43d1aed6fcae6bf7c798c7c2d6741825))


### Bug Fixes

* **deps:** update aws-sdk-js-v3 monorepo to v3.669.0 ([#1477](https://github.com/graasp/graasp/issues/1477)) ([5f0b875](https://github.com/graasp/graasp/commit/5f0b8759808fe4e8b9a00b382e1d7ca1079228dd))
* **deps:** update dependency @sentry/node to v7.119.1 ([#1482](https://github.com/graasp/graasp/issues/1482)) ([4d67a15](https://github.com/graasp/graasp/commit/4d67a150cf0789b2bdc834410fe1867618b0f1cc))
* **deps:** update dependency form-data to v4.0.1 ([#1502](https://github.com/graasp/graasp/issues/1502)) ([42363f7](https://github.com/graasp/graasp/commit/42363f708370db0241ecfe88bbeaba4e9f9f2116))
* **deps:** update dependency openai to v4.67.3 ([#1483](https://github.com/graasp/graasp/issues/1483)) ([5f2535f](https://github.com/graasp/graasp/commit/5f2535f5eb3e844cac6af6dae945fd20c0ef1062))
* **deps:** update dependency sanitize-html to v2.13.1 ([#1476](https://github.com/graasp/graasp/issues/1476)) ([0baa218](https://github.com/graasp/graasp/commit/0baa2184dbaaf04f45fa874b65ad3e1a78e72481))
* do not encode redirection url for password ([#1535](https://github.com/graasp/graasp/issues/1535)) ([8d07cda](https://github.com/graasp/graasp/commit/8d07cdab575f530f03ebac65a780ef1bcf2933c5))
* password reset token should be single use ([#1533](https://github.com/graasp/graasp/issues/1533)) ([531d8c2](https://github.com/graasp/graasp/commit/531d8c2a6f1e9d3790021d540a1e4efbf723607c))
* remove unused route `PATCH /items` ([#1505](https://github.com/graasp/graasp/issues/1505)) ([02f4f20](https://github.com/graasp/graasp/commit/02f4f20879b6087035b97a333bb8ca8aeb341697))
* update log group name to use for graasp core container to match infrastructure ([#1512](https://github.com/graasp/graasp/issues/1512)) ([bf215a9](https://github.com/graasp/graasp/commit/bf215a9e7e96e1e6691d066740c50f46e705ce38))
* update task def ([#1518](https://github.com/graasp/graasp/issues/1518)) ([01ffe3e](https://github.com/graasp/graasp/commit/01ffe3e1e3af4ca2acedb5fea8bc794ee22640fd))

## [1.53.1](https://github.com/graasp/graasp/compare/v1.53.0...v1.53.1) (2024-10-10)


### Bug Fixes

* register double encoding uri component ([#1492](https://github.com/graasp/graasp/issues/1492)) ([9585040](https://github.com/graasp/graasp/commit/958504077808128a5a6d24fe181fc6aec207eba7))
* remove dependency to fix deploy ([#1499](https://github.com/graasp/graasp/issues/1499)) ([782483d](https://github.com/graasp/graasp/commit/782483d8a93f137e218162cc50487db87a76bf61))
* save membership on item login schema item on item login ([#1467](https://github.com/graasp/graasp/issues/1467)) ([6def707](https://github.com/graasp/graasp/commit/6def707491f8dd06a9b08b1b3dfd4bab97e0f7b5))

## [1.53.0](https://github.com/graasp/graasp/compare/v1.52.0...v1.53.0) (2024-10-09)


### Features

* optimize thumbnails caching ([#1414](https://github.com/graasp/graasp/issues/1414)) ([4c8631f](https://github.com/graasp/graasp/commit/4c8631f3ed1c96458809d3d7724a15ce37a80ea7))


### Bug Fixes

* add yarn lock to docker build ([#1469](https://github.com/graasp/graasp/issues/1469)) ([ebbd7f8](https://github.com/graasp/graasp/commit/ebbd7f892c3e5c5a8a8616bf5d721683c5dfea7b))
* app actions structure is wrong for export ([#1479](https://github.com/graasp/graasp/issues/1479)) ([98c2fa7](https://github.com/graasp/graasp/commit/98c2fa71a50d88b737a4f640bb72bf156a295d77))
* **deps:** update dependency @graasp/sdk to v4.32.1 ([#1481](https://github.com/graasp/graasp/issues/1481)) ([0721447](https://github.com/graasp/graasp/commit/072144709a9e7a3abfcef229899207fe93b930bd))
* **deps:** update dependency @sinclair/typebox to v0.33.15 ([#1464](https://github.com/graasp/graasp/issues/1464)) ([dddd7dc](https://github.com/graasp/graasp/commit/dddd7dc9b3d33df20fad865d3f7cc2d494a4f986))
* **deps:** update dependency bullmq to v5.17.1 ([#1451](https://github.com/graasp/graasp/issues/1451)) ([34acaaa](https://github.com/graasp/graasp/commit/34acaaaa0414f71055b58ba1db4e6ce6df079a37))
* **deps:** update dependency bullmq to v5.18.0 ([#1486](https://github.com/graasp/graasp/issues/1486)) ([496faf2](https://github.com/graasp/graasp/commit/496faf2458cc74e049111621cce3c2478d01f7cd))
* **deps:** update dependency i18next to v23.15.2 ([#1452](https://github.com/graasp/graasp/issues/1452)) ([9d67343](https://github.com/graasp/graasp/commit/9d6734380b39980c9c85af91f3cd1a35ea4bb5fe))
* **deps:** update dependency openai to v4.67.2 ([#1456](https://github.com/graasp/graasp/issues/1456)) ([5f0abb0](https://github.com/graasp/graasp/commit/5f0abb08636a23cc9d7ca2d14132e97edfaf1de1))
* **deps:** update dependency pg to v8.13.0 ([#1457](https://github.com/graasp/graasp/issues/1457)) ([44e1f45](https://github.com/graasp/graasp/commit/44e1f455094b3adf0a4797046df606b3d7a07f5c))
* do not allow special characters in username ([#1406](https://github.com/graasp/graasp/issues/1406)) ([2e9ea18](https://github.com/graasp/graasp/commit/2e9ea18d6eaba0645446e8f5c0e14743bff9b9e9))
* flacky tests post items ([#1444](https://github.com/graasp/graasp/issues/1444)) ([ae7b2d7](https://github.com/graasp/graasp/commit/ae7b2d75ec8313f28b588b639d657d42f0f7ac48))

## [1.52.0](https://github.com/graasp/graasp/compare/v1.51.0...v1.52.0) (2024-09-27)


### Features

* add thumbnails urls in PackedItem ([#1398](https://github.com/graasp/graasp/issues/1398)) ([ed473b0](https://github.com/graasp/graasp/commit/ed473b0a813dbbf903060c89832802697f56f140))

## [1.51.0](https://github.com/graasp/graasp/compare/v1.50.2...v1.51.0) (2024-09-27)


### Features

* freeze or disable item login schema ([#1422](https://github.com/graasp/graasp/issues/1422)) ([2473342](https://github.com/graasp/graasp/commit/24733420e6efa6b09f0ce131b7a041c916836aba))

## [1.50.2](https://github.com/graasp/graasp/compare/v1.50.1...v1.50.2) (2024-09-26)


### Bug Fixes

* guest account migration ([#1426](https://github.com/graasp/graasp/issues/1426)) ([4ccec91](https://github.com/graasp/graasp/commit/4ccec9198cbd762c784130f30e49b46df35b9da4))

## [1.50.1](https://github.com/graasp/graasp/compare/v1.50.0...v1.50.1) (2024-09-24)


### Bug Fixes

* migrate guest account ([#1417](https://github.com/graasp/graasp/issues/1417)) ([306e4fa](https://github.com/graasp/graasp/commit/306e4fa3fc79127e9245e954d77698ff69d189f6))

## [1.50.0](https://github.com/graasp/graasp/compare/v1.49.0...v1.50.0) (2024-09-23)


### Features

* can create a permission on item login without admin's confirmation ([#1364](https://github.com/graasp/graasp/issues/1364)) ([a2e9f0c](https://github.com/graasp/graasp/commit/a2e9f0c4f0c2223e1a4241927e409972ad73b304))
* item like with typebox ([#1402](https://github.com/graasp/graasp/issues/1402)) ([bb1e057](https://github.com/graasp/graasp/commit/bb1e05728102aae814a5c3b4eab01010215abf89))
* sanitize filename ([#1374](https://github.com/graasp/graasp/issues/1374)) ([2523506](https://github.com/graasp/graasp/commit/2523506233921ace19c7d9697c3ede0fa9295fa4))
* **schema refactor:** service account ([#1408](https://github.com/graasp/graasp/issues/1408)) ([63477df](https://github.com/graasp/graasp/commit/63477df8a364761e08957dfd965e40c202a191f4))


### Bug Fixes

* deprecate patch member use current member instead ([#1399](https://github.com/graasp/graasp/issues/1399)) ([21ece6c](https://github.com/graasp/graasp/commit/21ece6c133adb8d0e55ea566c60b85f3092589f8))
* set jest extension to run on-demand instead of watch ([#1401](https://github.com/graasp/graasp/issues/1401)) ([ec14145](https://github.com/graasp/graasp/commit/ec14145aca703c2630df65e7374bc83fbe0b4a8e))

## [1.49.0](https://github.com/graasp/graasp/compare/v1.48.0...v1.49.0) (2024-09-18)


### Features

* add back member key in app endpoints ([#1389](https://github.com/graasp/graasp/issues/1389)) ([2cb9fa3](https://github.com/graasp/graasp/commit/2cb9fa38f771078edd8abe0feed0a2444e764b2e))
* cannot get item login schema type of hidden item ([#1365](https://github.com/graasp/graasp/issues/1365)) ([1a66c71](https://github.com/graasp/graasp/commit/1a66c71786d5b82b6fd396ecf44ad9ae3d843f45))
* use max ZIP file size from SDK ([#1373](https://github.com/graasp/graasp/issues/1373)) ([895dce3](https://github.com/graasp/graasp/commit/895dce37937d75ce6effa9cd65774ab00b27b1c1))


### Bug Fixes

* **deps:** update dependency @graasp/translations to v1.36.1 ([#1378](https://github.com/graasp/graasp/issues/1378)) ([e13e75b](https://github.com/graasp/graasp/commit/e13e75be4c8f6c3bfa05b161a823622579a1cee2))
* **deps:** update dependency bullmq to v5.13.0 ([#1265](https://github.com/graasp/graasp/issues/1265)) ([04bf9fc](https://github.com/graasp/graasp/commit/04bf9fce0256c233a13337cd5a1d295037c7113c))
* **deps:** update dependency h5p-standalone to v3.7.0 ([#1260](https://github.com/graasp/graasp/issues/1260)) ([e4d81a6](https://github.com/graasp/graasp/commit/e4d81a6ceaeb9e736ffacc7ab07c0896e5b5093f))
* **deps:** update dependency i18next to v23.12.7 ([#1353](https://github.com/graasp/graasp/issues/1353)) ([9c03393](https://github.com/graasp/graasp/commit/9c033931548336cd031bc2e99a1bba8c96138a43))
* **deps:** update dependency pdf2pic to v3.1.3 ([#1382](https://github.com/graasp/graasp/issues/1382)) ([69dad6c](https://github.com/graasp/graasp/commit/69dad6cd6bcde843c8a8f1cd32367f9df9bbe4fa))
* **deps:** update dependency sharp to v0.33.5 ([#1354](https://github.com/graasp/graasp/issues/1354)) ([d172146](https://github.com/graasp/graasp/commit/d17214696f9b2a86c932fe920259e93c97b433bc))
* **deps:** update dependency uuid to v10 ([#1263](https://github.com/graasp/graasp/issues/1263)) ([13fa2d4](https://github.com/graasp/graasp/commit/13fa2d41cadb2d25233e65457d5ac74ac779c4c6))

## [1.48.0](https://github.com/graasp/graasp/compare/v1.47.0...v1.48.0) (2024-09-12)


### Features

* allow exporting etherpad ([#1343](https://github.com/graasp/graasp/issues/1343)) ([df38327](https://github.com/graasp/graasp/commit/df383279160091a00e298fe421f8576860c912a9))
* item login users are different than members  ([#1131](https://github.com/graasp/graasp/issues/1131)) ([48342d4](https://github.com/graasp/graasp/commit/48342d4919f4c1e5652ed8f8b520f53eab984d7d))
* restrict guest's membership modifications ([#1363](https://github.com/graasp/graasp/issues/1363)) ([9f71c0e](https://github.com/graasp/graasp/commit/9f71c0e9a77d942ba3ab8abbc52d991787b09035))


### Bug Fixes

* **deps:** update aws-sdk-js-v3 monorepo to v3.637.0 ([#1255](https://github.com/graasp/graasp/issues/1255)) ([2545aed](https://github.com/graasp/graasp/commit/2545aedafba37539a026553f820d657144aaf6ea))
* **deps:** update dependency @fastify/swagger-ui to v4.0.1 ([#1321](https://github.com/graasp/graasp/issues/1321)) ([d5fccbe](https://github.com/graasp/graasp/commit/d5fccbef9672305a22ad2db7f2fcd850d745dc0f))
* **deps:** update dependency openai to v4.56.0 ([#1261](https://github.com/graasp/graasp/issues/1261)) ([f0a65c8](https://github.com/graasp/graasp/commit/f0a65c894bb7a51cc304d4ef7dec759ebefc0ce0))
* **french:** update translations ([#1329](https://github.com/graasp/graasp/issues/1329)) ([ab861b8](https://github.com/graasp/graasp/commit/ab861b86f704bfc3720756e7928d0268ef0b8efd))
* membership request out of fastify cors scope ([#1352](https://github.com/graasp/graasp/issues/1352)) ([f02c593](https://github.com/graasp/graasp/commit/f02c593b85e74960979689bd6ef8b14ee55716dd))
* **MutableRepository:** use getOne in updateOne ([#1346](https://github.com/graasp/graasp/issues/1346)) ([55f1730](https://github.com/graasp/graasp/commit/55f1730f1051c38d22a0a4bef968ab8f7497ca00))
* remove deprecated packages ([#1259](https://github.com/graasp/graasp/issues/1259)) ([8f6f26a](https://github.com/graasp/graasp/commit/8f6f26a08b857e2e231b3fee95affebf4c6fc1a7))

## [1.47.0](https://github.com/graasp/graasp/compare/v1.46.0...v1.47.0) (2024-08-19)


### Features

* api route to check if password is defined ([#1284](https://github.com/graasp/graasp/issues/1284)) ([46ac230](https://github.com/graasp/graasp/commit/46ac2304976b4c9a9b39da86cf8ecf88412f0fde))
* convert SVG to PNG and send it to nudenet ([#1272](https://github.com/graasp/graasp/issues/1272)) ([c0533cc](https://github.com/graasp/graasp/commit/c0533cc542b6854c5d60c555c72804f77509a4e0))
* copy suffix is determined by siblings ([#1222](https://github.com/graasp/graasp/issues/1222)) ([90c6501](https://github.com/graasp/graasp/commit/90c6501752f1975682b53f92ace5761950929487))
* implement fastify swagger ([#1225](https://github.com/graasp/graasp/issues/1225)) ([3f54c96](https://github.com/graasp/graasp/commit/3f54c9680f867917c608e14e2099dec1f356d6ed))
* **membership request:** create entity and base structure ([#1281](https://github.com/graasp/graasp/issues/1281)) ([aed2b5a](https://github.com/graasp/graasp/commit/aed2b5aafe3533f37e9537ba79e498f7f670988e))
* **membership request:** delete request route ([#1299](https://github.com/graasp/graasp/issues/1299)) ([66149fd](https://github.com/graasp/graasp/commit/66149fd95818e9530e2cc40836d5680a310821cf))
* **membership request:** get all requests from an item ([#1293](https://github.com/graasp/graasp/issues/1293)) ([904e647](https://github.com/graasp/graasp/commit/904e647cb5e242e52c993a1fcedb219af13bb885))
* **membership request:** get status of you own request ([#1300](https://github.com/graasp/graasp/issues/1300)) ([27333ea](https://github.com/graasp/graasp/commit/27333eaca86ec59ee6efe833db642145bf972f0e))
* **membership request:** request creation api route ([#1290](https://github.com/graasp/graasp/issues/1290)) ([2968a67](https://github.com/graasp/graasp/commit/2968a67f43eb1378a8c49149e298d7cf49ce4aa1))
* pdf thumbnail ([#1307](https://github.com/graasp/graasp/issues/1307)) ([8ae0c23](https://github.com/graasp/graasp/commit/8ae0c23884976e961cce5bc05cc3f9169a7ec9ef))
* save publication progress in Redis ([#1247](https://github.com/graasp/graasp/issues/1247)) ([deb892d](https://github.com/graasp/graasp/commit/deb892d3107e1d5dfe33aafc8868b842a91c6780))
* storage details route ([#1271](https://github.com/graasp/graasp/issues/1271)) ([792b347](https://github.com/graasp/graasp/commit/792b3476d81a92ef0b10389081983fbf6356a133))
* **storage files metadata:** default ordering by size ([#1279](https://github.com/graasp/graasp/issues/1279)) ([8e75760](https://github.com/graasp/graasp/commit/8e75760415ec2cd867e18fb33d18cb44be6aade5))
* update invite invitation to include membership creation ([#1274](https://github.com/graasp/graasp/issues/1274)) ([117a409](https://github.com/graasp/graasp/commit/117a409000137c46ec56f615a51684349ee2afbe))
* validate the thumbnail of items ([#1277](https://github.com/graasp/graasp/issues/1277)) ([4a276ba](https://github.com/graasp/graasp/commit/4a276ba0e4a9200a9aa5dd864ce4c0b5bb26f6c6))

## [1.46.0](https://github.com/graasp/graasp/compare/v1.45.0...v1.46.0) (2024-07-31)


### Features

* add member password routes (POST and update PATCH) ([#1236](https://github.com/graasp/graasp/issues/1236)) ([510cb8b](https://github.com/graasp/graasp/commit/510cb8b9d5603d4e3d9cdabe80c2c116e7d40cea))
* allow publishing only for validated items ([#1230](https://github.com/graasp/graasp/issues/1230)) ([ccfe668](https://github.com/graasp/graasp/commit/ccfe6687e9e7c2303efa42d50a4d5525b88c1660))
* improve search for accessible and children ([#1244](https://github.com/graasp/graasp/issues/1244)) ([fe76981](https://github.com/graasp/graasp/commit/fe7698109f9cb7f129ef66ae9d0681728aab09d2))
* modify get actions and get actions aggregate to have a start and end date ([#1239](https://github.com/graasp/graasp/issues/1239)) ([3c5ad2c](https://github.com/graasp/graasp/commit/3c5ad2c8c65751c777a07aeb148cb8ef54efd037))
* update the unpublsihed state ([#1226](https://github.com/graasp/graasp/issues/1226)) ([d976dea](https://github.com/graasp/graasp/commit/d976dea6329baa6a3d405f6af01c2435038d5217))


### Bug Fixes

* allow to download raw file ([#1246](https://github.com/graasp/graasp/issues/1246)) ([f2c592f](https://github.com/graasp/graasp/commit/f2c592f8414f67571d4115e5238342d79109edc0))
* **deps:** update dependency @graasp/translations to v1.33.0 ([#1257](https://github.com/graasp/graasp/issues/1257)) ([43206c2](https://github.com/graasp/graasp/commit/43206c2bbf06709497ca26b7525da38165eaf8be))
* **deps:** update dependency archiver to v7 ([#1211](https://github.com/graasp/graasp/issues/1211)) ([d8c5741](https://github.com/graasp/graasp/commit/d8c57415be18577c1a1f55aefb20520044fbe889))
* **deps:** update dependency bullmq to v5 ([#1212](https://github.com/graasp/graasp/issues/1212)) ([c55976c](https://github.com/graasp/graasp/commit/c55976c06c69c9f4ced04f1abbd723ff66ad5a95))
* **deps:** update dependency fast-json-stringify to v6 ([#1213](https://github.com/graasp/graasp/issues/1213)) ([9efd55a](https://github.com/graasp/graasp/commit/9efd55a51791312290c8f9ce634bad35016d1188))
* **deps:** update dependency i18next to v23.12.2 ([#1253](https://github.com/graasp/graasp/issues/1253)) ([0b5c8b2](https://github.com/graasp/graasp/commit/0b5c8b2ed5ec9be0665204d78f7ed3ae3b138e98))
* fix where scope on search ([#1245](https://github.com/graasp/graasp/issues/1245)) ([6d6c2b9](https://github.com/graasp/graasp/commit/6d6c2b9d5d1b1408c0c0a525c89daf6295b3776a))
* lift up Pagination types and use ones defined in sdk ([#1238](https://github.com/graasp/graasp/issues/1238)) ([b76f640](https://github.com/graasp/graasp/commit/b76f640b939008bc5235d020edc3a458f8145d86))
* log group in dev should be `ecs/graasp` ([#1250](https://github.com/graasp/graasp/issues/1250)) ([b21c4d8](https://github.com/graasp/graasp/commit/b21c4d80ab2196c27fc70b072fdf14362dc9c8db))
* release please workflow to use PAT ([#1240](https://github.com/graasp/graasp/issues/1240)) ([7446772](https://github.com/graasp/graasp/commit/7446772b219501e08e26ad469e21e9d6a8b46b46))
* remove mock for datasource ([#1234](https://github.com/graasp/graasp/issues/1234)) ([cd0b079](https://github.com/graasp/graasp/commit/cd0b07997a6976f77b27f37c0cf7ac4f40b49723))

## [1.45.0](https://github.com/graasp/graasp/compare/v1.44.0...v1.45.0) (2024-07-24)


### Features

* change last migration to set legacy data validation to true ([#1232](https://github.com/graasp/graasp/issues/1232)) ([edbb727](https://github.com/graasp/graasp/commit/edbb7276948d5b556b92909faa0d9edbc18e0612))
* compute the publication state in the backend ([#1180](https://github.com/graasp/graasp/issues/1180)) ([f4996cd](https://github.com/graasp/graasp/commit/f4996cd205ec3f30f982fc7a80bee00d4465b196))
* **refactor:** update MagicLinkService to allow injection using DI ([#1198](https://github.com/graasp/graasp/issues/1198)) ([c70d93c](https://github.com/graasp/graasp/commit/c70d93cca07eea65679fe0a45b696ea79cda6063))
* **refactor:** update MobileService to allow injection using DI ([#1196](https://github.com/graasp/graasp/issues/1196)) ([b6d43c5](https://github.com/graasp/graasp/commit/b6d43c50454dda89123bfab79924246a6f06b8c4))
* restrict members that didn't validate their email ([#1113](https://github.com/graasp/graasp/issues/1113)) ([62915ac](https://github.com/graasp/graasp/commit/62915ac102c363f9d8d719cddbe02caee9fbb3ee))


### Bug Fixes

* **deps:** update dependency @fastify/busboy to v3 ([#1191](https://github.com/graasp/graasp/issues/1191)) ([5122592](https://github.com/graasp/graasp/commit/5122592babf4efa4b03f39ad0744530ba2dd621d))
* **deps:** update dependency @fastify/cors to v9 ([#1183](https://github.com/graasp/graasp/issues/1183)) ([6db4212](https://github.com/graasp/graasp/commit/6db4212d7f6ff03fc80def4a43928b2dde18cf0e))
* **deps:** update dependency @fastify/forwarded to v3 ([#1208](https://github.com/graasp/graasp/issues/1208)) ([fc71c98](https://github.com/graasp/graasp/commit/fc71c9830b112d431ebd82e7f04ea24e9690c3e9))
* **deps:** update dependency @fastify/multipart to v8 ([#1192](https://github.com/graasp/graasp/issues/1192)) ([c055cf8](https://github.com/graasp/graasp/commit/c055cf8704c86020330d0011ab604f1c084e8466))
* **deps:** update dependency @fastify/static to v7 ([#1193](https://github.com/graasp/graasp/issues/1193)) ([fd8ce4b](https://github.com/graasp/graasp/commit/fd8ce4b1c4e8c1d872715a2afe50d2d4a338b9a4))
* **deps:** update dependency ajv to v8.17.1 ([#1201](https://github.com/graasp/graasp/issues/1201)) ([82a72af](https://github.com/graasp/graasp/commit/82a72af71635ca94ffa351448c148c9874a27181))
* **deps:** update dependency fluent-json-schema to v5 ([#1214](https://github.com/graasp/graasp/issues/1214)) ([23a2f1b](https://github.com/graasp/graasp/commit/23a2f1b284a7135df7409277aa86f3b60523afc2))
* **deps:** update dependency i18next to v23.12.1 ([#1206](https://github.com/graasp/graasp/issues/1206)) ([02285f6](https://github.com/graasp/graasp/commit/02285f65f8d11ff46cc16e6429cd8c97c8ea98f1))
* remove leaked information and remove unused errors ([#1204](https://github.com/graasp/graasp/issues/1204)) ([312f6d6](https://github.com/graasp/graasp/commit/312f6d651662550e2118b0e157f75249da41ee2f))
* sort descendants as number ([#1221](https://github.com/graasp/graasp/issues/1221)) ([2f1f7b4](https://github.com/graasp/graasp/commit/2f1f7b440a192fc6aee14c213938899a7d212886))

## [1.44.0](https://github.com/graasp/graasp/compare/v1.43.1...v1.44.0) (2024-07-12)


### Features

* improve reordering mechanism and allow to create items with order  ([#1119](https://github.com/graasp/graasp/issues/1119)) ([38c6fe0](https://github.com/graasp/graasp/commit/38c6fe02ecc2c568d71b6ecb470c1401c0242fe4))
* use DI to inject services ([#1095](https://github.com/graasp/graasp/issues/1095)) ([2132dc2](https://github.com/graasp/graasp/commit/2132dc2027d0dc95c2f5d4c5367a19039570c70c))


### Bug Fixes

* add email in link for email update ([#1186](https://github.com/graasp/graasp/issues/1186)) ([e668337](https://github.com/graasp/graasp/commit/e6683376ea36a76f49d67ac1e2757e3a3499e195))
* **deps:** remove dependency qs ([#1166](https://github.com/graasp/graasp/issues/1166)) ([d9c6e18](https://github.com/graasp/graasp/commit/d9c6e180eb989af4b00a1e3717ad6ea2fc3c5a90))
* **deps:** update aws-sdk-js-v3 monorepo to v3.609.0 ([#1167](https://github.com/graasp/graasp/issues/1167)) ([5fc9488](https://github.com/graasp/graasp/commit/5fc9488eb1e492e0430a0d50d63cbaf8a0f8b824))
* **deps:** update aws-sdk-js-v3 monorepo to v3.614.0 ([#1190](https://github.com/graasp/graasp/issues/1190)) ([1e71146](https://github.com/graasp/graasp/commit/1e7114652ee1d0bc288a882813f8a741ba47a735))
* **deps:** update dependency @fastify/passport to v2.5.0 ([#1155](https://github.com/graasp/graasp/issues/1155)) ([067216e](https://github.com/graasp/graasp/commit/067216e44bf11912f1e587f59241af32846feaf2))
* **deps:** update dependency @graasp/sdk to v4.15.1 ([#1136](https://github.com/graasp/graasp/issues/1136)) ([3de759c](https://github.com/graasp/graasp/commit/3de759c5c0b5222ec74f718742a0ff92a72a6fce))
* **deps:** update dependency @graasp/translations to v1.31.3 ([#1185](https://github.com/graasp/graasp/issues/1185)) ([5b6ec23](https://github.com/graasp/graasp/commit/5b6ec235d55976a79e768224a610091103306e6c))
* **deps:** update dependency @graasp/translations to v1.32.0 ([#1156](https://github.com/graasp/graasp/issues/1156)) ([51bbfc7](https://github.com/graasp/graasp/commit/51bbfc79d5d2f1f5eeb8c2e611b4b869a486f7b3))
* **deps:** update dependency @sentry/node to v7.118.0 ([#1168](https://github.com/graasp/graasp/issues/1168)) ([96967f9](https://github.com/graasp/graasp/commit/96967f9a5225dab987effefa254f0d7d5bcc3252))
* **deps:** update dependency fast-json-stringify to v5.16.1 ([#1139](https://github.com/graasp/graasp/issues/1139)) ([5fc5666](https://github.com/graasp/graasp/commit/5fc5666734c3b38c23e2e2917630598bcbd58f22))
* **deps:** update dependency fastify to v4.28.1 ([#1169](https://github.com/graasp/graasp/issues/1169)) ([0b5c441](https://github.com/graasp/graasp/commit/0b5c441a3130f49dafe86df9357f08f43fa7db77))
* **deps:** update dependency meilisearch to v0.41.0 ([#1171](https://github.com/graasp/graasp/issues/1171)) ([8f420f1](https://github.com/graasp/graasp/commit/8f420f1ee37ebf72e558cb11a8197537c1abe9c2))
* **deps:** update dependency nodemailer to v6.9.14 ([#1187](https://github.com/graasp/graasp/issues/1187)) ([f962e11](https://github.com/graasp/graasp/commit/f962e11ddf0c4697a557245953ba549c79e07774))
* **deps:** update dependency openai to v4.52.3 ([#1172](https://github.com/graasp/graasp/issues/1172)) ([ccc0751](https://github.com/graasp/graasp/commit/ccc075148b39e6baac350145d98cb148ba4f16f1))
* **deps:** update dependency openai to v4.52.7 ([#1188](https://github.com/graasp/graasp/issues/1188)) ([c4fe9fd](https://github.com/graasp/graasp/commit/c4fe9fda80c66daad04e085f2fd2ed6b939905c3))
* **deps:** update dependency ws to v8.18.0 ([#1173](https://github.com/graasp/graasp/issues/1173)) ([2756224](https://github.com/graasp/graasp/commit/2756224bcaa3f2f46884480330f9d566a2ed0ca4))
* filter out smartly given descendants ([#1162](https://github.com/graasp/graasp/issues/1162)) ([e354f2b](https://github.com/graasp/graasp/commit/e354f2ba0a6e07131e47edfc1b3af2a66de3044c))
* logout member on delete ([#1158](https://github.com/graasp/graasp/issues/1158)) ([2ca19c9](https://github.com/graasp/graasp/commit/2ca19c9af2007d170a056ab55488b1b09f9cef42))
* replace luxon by date-fns ([#967](https://github.com/graasp/graasp/issues/967)) ([5923b29](https://github.com/graasp/graasp/commit/5923b291cbf01729952ed3e7f19392c3cb55ceef))

## [1.43.1](https://github.com/graasp/graasp/compare/v1.43.0...v1.43.1) (2024-07-01)


### Bug Fixes

* **arabic:** update translations ([#1144](https://github.com/graasp/graasp/issues/1144)) ([eea60db](https://github.com/graasp/graasp/commit/eea60dbd3beac474c59e9c8f26c1583b3ce53496))
* **deps:** update aws-sdk-js-v3 monorepo to v3.606.0 ([#1102](https://github.com/graasp/graasp/issues/1102)) ([c71a070](https://github.com/graasp/graasp/commit/c71a0700b9d95a7c7761576a59632880c04cef40))
* **deps:** update dependency ajv to v8.16.0 ([#1085](https://github.com/graasp/graasp/issues/1085)) ([44992c1](https://github.com/graasp/graasp/commit/44992c1b110b8b32b9a146623b433abbdcda5a20))
* **deps:** update dependency openai to v4.48.3 ([#1091](https://github.com/graasp/graasp/issues/1091)) ([8639f7e](https://github.com/graasp/graasp/commit/8639f7e709d41e3fdfcb97a2f5389b8ac01ce61e))
* **deps:** update dependency ws to v8.17.1 [security] ([#1118](https://github.com/graasp/graasp/issues/1118)) ([39a7ea3](https://github.com/graasp/graasp/commit/39a7ea3836eea05a3b24becf4354c350cbc92083))
* fix deploy files for email var ([#1133](https://github.com/graasp/graasp/issues/1133)) ([3f7e36d](https://github.com/graasp/graasp/commit/3f7e36dad13241a03d5fef951092fb46bf96b30b))
* **french:** update translations ([#1146](https://github.com/graasp/graasp/issues/1146)) ([f8db299](https://github.com/graasp/graasp/commit/f8db299104b900bc2fd1802ef801e6c1344ac4d5))
* **german:** update translations ([#1143](https://github.com/graasp/graasp/issues/1143)) ([9c82033](https://github.com/graasp/graasp/commit/9c82033acaee6868e6f72e56b8b8f3efe402d6b2))
* **italian:** update translations ([#1147](https://github.com/graasp/graasp/issues/1147)) ([730f503](https://github.com/graasp/graasp/commit/730f5034eabea25c78624bb39d369a8458061390))
* remove memberId authentication from item login ([#1142](https://github.com/graasp/graasp/issues/1142)) ([c8f3ad0](https://github.com/graasp/graasp/commit/c8f3ad04e4ebca1a03c6575f40222f9e3107d8b6))
* **spanish:** update translations ([#1145](https://github.com/graasp/graasp/issues/1145)) ([27b4b70](https://github.com/graasp/graasp/commit/27b4b709ed4b0e7dd2c973358160841bf467aed3))
* test ([#1132](https://github.com/graasp/graasp/issues/1132)) ([6d93caa](https://github.com/graasp/graasp/commit/6d93caa4f6748f8c7205586c2048cd7e6140930c))

## [1.43.0](https://github.com/graasp/graasp/compare/v1.42.1...v1.43.0) (2024-06-28)


### Features

* member edit email ([#1122](https://github.com/graasp/graasp/issues/1122)) ([39e5d7b](https://github.com/graasp/graasp/commit/39e5d7b4af9abc8e56ee8cd5166f005fd4dee85b))


### Bug Fixes

* add alignment setting ([#1124](https://github.com/graasp/graasp/issues/1124)) ([7b428b4](https://github.com/graasp/graasp/commit/7b428b414baa6edec7271912572ea1ba2f4d9d82))
* email regex for .swiss emails ([#1129](https://github.com/graasp/graasp/issues/1129)) ([eef770c](https://github.com/graasp/graasp/commit/eef770c8c6a5bef45f33477df3ed9dcfcedad24f))
* eslint warnings ([#1126](https://github.com/graasp/graasp/issues/1126)) ([79cadc3](https://github.com/graasp/graasp/commit/79cadc3ddd560744a0d0a96181e9cb0ab01d4a34))
* update translations ([#1120](https://github.com/graasp/graasp/issues/1120)) ([869e727](https://github.com/graasp/graasp/commit/869e727809c343885544014fc6ee20c5dab77a44))

## [1.42.1](https://github.com/graasp/graasp/compare/v1.42.0...v1.42.1) (2024-06-13)


### Bug Fixes

* allow yearFrom and yearTo to be numbers as some editors save them like this ([#1111](https://github.com/graasp/graasp/issues/1111)) ([d872e9a](https://github.com/graasp/graasp/commit/d872e9aa980a047522957e722f812c3432e3edda))

## [1.42.0](https://github.com/graasp/graasp/compare/v1.41.0...v1.42.0) (2024-06-13)


### Features

* restrict publication to folders only ([#1106](https://github.com/graasp/graasp/issues/1106)) ([9f61157](https://github.com/graasp/graasp/commit/9f611573b8feae3fd6d834a5e277e9edb20e689f))


### Bug Fixes

* many tags items length ([#1108](https://github.com/graasp/graasp/issues/1108)) ([b74bd2c](https://github.com/graasp/graasp/commit/b74bd2c3d24c0eadc52a99d44d9800dbae974007))

## [1.41.0](https://github.com/graasp/graasp/compare/v1.40.1...v1.41.0) (2024-06-13)


### Features

* filters item type and hidden item ([#1103](https://github.com/graasp/graasp/issues/1103)) ([c2a1ed6](https://github.com/graasp/graasp/commit/c2a1ed6825ba88d39bb5061e4f8a85b6487c3851))
* publish automatically when item is validated ([#1077](https://github.com/graasp/graasp/issues/1077)) ([be338e2](https://github.com/graasp/graasp/commit/be338e2fed8993c51b5d79329414f72f1c705fa7))

## [1.40.1](https://github.com/graasp/graasp/compare/v1.40.0...v1.40.1) (2024-06-05)


### Bug Fixes

* check that array is empty before getting many tags ([#1079](https://github.com/graasp/graasp/issues/1079)) ([5af01f2](https://github.com/graasp/graasp/commit/5af01f2a213df628b40818561309908e3a6ea40c))
* **deps:** update aws-sdk-js-v3 monorepo to v3.590.0 ([#1051](https://github.com/graasp/graasp/issues/1051)) ([112fd61](https://github.com/graasp/graasp/commit/112fd613253bc4f0e6de3401875cc96856cdfe10))
* **deps:** update dependency @graasp/sdk to v4.12.1 ([#1076](https://github.com/graasp/graasp/issues/1076)) ([8579207](https://github.com/graasp/graasp/commit/8579207ddaf9e5a507c6db25430075986b7412b0))
* **deps:** update dependency fast-json-stringify to v5.16.0 ([#1086](https://github.com/graasp/graasp/issues/1086)) ([122d413](https://github.com/graasp/graasp/commit/122d413699d19484a54a4ed919e2f7717233d9eb))
* **deps:** update dependency openai to v4.47.3 ([#1083](https://github.com/graasp/graasp/issues/1083)) ([7807188](https://github.com/graasp/graasp/commit/7807188f741c838960faca7a21930d2ead533a24))
* **deps:** update dependency openai to v4.48.1 ([#1087](https://github.com/graasp/graasp/issues/1087)) ([16470e6](https://github.com/graasp/graasp/commit/16470e69fd12cc328a1a180f0a710060db957058))
* **deps:** update dependency pg to v8.12.0 ([#1088](https://github.com/graasp/graasp/issues/1088)) ([9b0c10c](https://github.com/graasp/graasp/commit/9b0c10c6c3a36e7a140139a0d1fe5d8d2dff9c78))

## [1.40.0](https://github.com/graasp/graasp/compare/v1.39.0...v1.40.0) (2024-05-29)


### Features

* create an api to get user actions for dashboard view ([#987](https://github.com/graasp/graasp/issues/987)) ([fd9f9d5](https://github.com/graasp/graasp/commit/fd9f9d50f73b69985f4e3584e6f9f6da6ad04df9))
* create export actions with csv format ([#1022](https://github.com/graasp/graasp/issues/1022)) ([89fe445](https://github.com/graasp/graasp/commit/89fe4450f59c30e1103e0cafeead64dd333f3446))


### Bug Fixes

* allow to update link url and disallow editing html ([#1058](https://github.com/graasp/graasp/issues/1058)) ([1a657fb](https://github.com/graasp/graasp/commit/1a657fb437cb07daaac538ebde189c477cf00f4e))
* copy suffix can't increment past 3 ([#1072](https://github.com/graasp/graasp/issues/1072)) ([50ef2e2](https://github.com/graasp/graasp/commit/50ef2e259dacf9f11e7bc7f39200014f645dc8fa))

## [1.39.0](https://github.com/graasp/graasp/compare/v1.38.0...v1.39.0) (2024-05-24)


### Features

* reset password ([#1021](https://github.com/graasp/graasp/issues/1021)) ([9fe3ba3](https://github.com/graasp/graasp/commit/9fe3ba31788b4c4292730d56ad93f5e9656505ff))


### Bug Fixes

* **deps:** update dependency sanitize-html to v2.13.0 ([#1042](https://github.com/graasp/graasp/issues/1042)) ([3fb73e2](https://github.com/graasp/graasp/commit/3fb73e210b1fd7c62614e01f1c3d2fad36821541))
* **deps:** update sentry packages ([#1047](https://github.com/graasp/graasp/issues/1047)) ([94ace8f](https://github.com/graasp/graasp/commit/94ace8fbfe462a302847d7e062afa8a3c1a0c2af))
* getIn geoloc returns public only inside item ([#1053](https://github.com/graasp/graasp/issues/1053)) ([d9f68e9](https://github.com/graasp/graasp/commit/d9f68e9cd60321bceb9fbc29913c7029663171e9))
* use yarn4 in dockerfile ([#1061](https://github.com/graasp/graasp/issues/1061)) ([ec0089e](https://github.com/graasp/graasp/commit/ec0089ee60ae0b45748ab7fcad36e65ea30bf34c))

## [1.38.0](https://github.com/graasp/graasp/compare/v1.37.0...v1.38.0) (2024-05-16)


### Features

* add endpoint for most-used apps per user ([#992](https://github.com/graasp/graasp/issues/992)) ([c693b40](https://github.com/graasp/graasp/commit/c693b40da274c9a86caef824ffb2486a46651189))
* pretty logs ([#1025](https://github.com/graasp/graasp/issues/1025)) ([146689f](https://github.com/graasp/graasp/commit/146689f4af8179b993ce538984833c924528b0e7))


### Bug Fixes

* **arabic:** translations ([#1028](https://github.com/graasp/graasp/issues/1028)) ([e5cd9a2](https://github.com/graasp/graasp/commit/e5cd9a21c9f64e72d30a9a56259f0f2acd739c90))
* **build:** use alpine version of node docker image ([#1008](https://github.com/graasp/graasp/issues/1008)) ([39d1dea](https://github.com/graasp/graasp/commit/39d1dea5d60a3b610fbc7e74e7fd8168d00acadb))
* **chatbot:** add support for gpt-4o model ([39f722d](https://github.com/graasp/graasp/commit/39f722d1df20832cd2060f18ced0428c7aa4d892))
* creator serialisation issue ([#1033](https://github.com/graasp/graasp/issues/1033)) ([2e4cd21](https://github.com/graasp/graasp/commit/2e4cd21395ba6eb2ae66a1efe62dd54b8b768f30))
* **deps:** update aws-sdk-js-v3 monorepo to v3.577.0 ([#1018](https://github.com/graasp/graasp/issues/1018)) ([a55ecb9](https://github.com/graasp/graasp/commit/a55ecb9092f6d0fdf710ef8948f8ccd3f703f313))
* **deps:** update dependency @fastify/helmet to v11 ([#1029](https://github.com/graasp/graasp/issues/1029)) ([7d7f763](https://github.com/graasp/graasp/commit/7d7f7631954a7553a59964aa9212b2ce56cd0410))
* **deps:** update dependency @graasp/sdk to v4.10.1 ([#1035](https://github.com/graasp/graasp/issues/1035)) ([39f722d](https://github.com/graasp/graasp/commit/39f722d1df20832cd2060f18ced0428c7aa4d892))
* **deps:** update dependency ajv to v8.13.0 ([#1036](https://github.com/graasp/graasp/issues/1036)) ([8fd80a8](https://github.com/graasp/graasp/commit/8fd80a84e38754e3d0ba24f247bfa682844c8fdd))
* **deps:** update dependency fast-json-stringify to v5.15.1 ([#1040](https://github.com/graasp/graasp/issues/1040)) ([3fbf5f7](https://github.com/graasp/graasp/commit/3fbf5f7b685c55e0812df567bee2be242c00b49a))
* **deps:** update dependency fastify to v4.27.0 ([#1041](https://github.com/graasp/graasp/issues/1041)) ([c429b76](https://github.com/graasp/graasp/commit/c429b7647fcff7b947586a16e5c8bda8c25d03f7))
* **deps:** update dependency meilisearch to v0.40.0 ([#965](https://github.com/graasp/graasp/issues/965)) ([bd341a3](https://github.com/graasp/graasp/commit/bd341a3f6292a1575af0d24c8724c8f075c26884))
* **deps:** update dependency openai to v4.47.1 ([#1006](https://github.com/graasp/graasp/issues/1006)) ([4992fd9](https://github.com/graasp/graasp/commit/4992fd9d52805fe3270235436fb97bcd7b20bedd))
* **deps:** update dependency pg to v8.11.5 ([#968](https://github.com/graasp/graasp/issues/968)) ([616af2a](https://github.com/graasp/graasp/commit/616af2a28381939035e9896897f6cafeb87574db))
* **deps:** update dependency sharp to v0.33.4 ([#1045](https://github.com/graasp/graasp/issues/1045)) ([2b2d577](https://github.com/graasp/graasp/commit/2b2d57763eec15c03f49dfe3b8e65352ba658d30))
* **deps:** update dependency ws to v8.17.0 ([#1046](https://github.com/graasp/graasp/issues/1046)) ([ce06cc1](https://github.com/graasp/graasp/commit/ce06cc1eeec027e3edbc9101970ae3540174e48b))

## [1.37.0](https://github.com/graasp/graasp/compare/v1.36.0...v1.37.0) (2024-05-07)


### Features

* add more packed items ([#925](https://github.com/graasp/graasp/issues/925)) ([56f0d2f](https://github.com/graasp/graasp/commit/56f0d2f7b9bea837cb0999fd8787088f737e46ed))


### Bug Fixes

* **deps:** update dependency ioredis to v5.4.1 ([#1005](https://github.com/graasp/graasp/issues/1005)) ([0355416](https://github.com/graasp/graasp/commit/03554167d1aae0ba76d8ac6e8ded7908bfc5c91f))
* **spanish:** translation ([#1019](https://github.com/graasp/graasp/issues/1019)) ([555c607](https://github.com/graasp/graasp/commit/555c607c5d74f7d871f38c4c5a669db13d2ccef7))

## [1.36.0](https://github.com/graasp/graasp/compare/v1.35.0...v1.36.0) (2024-05-03)


### Features

* implements automatic suffix to copied item ([#997](https://github.com/graasp/graasp/issues/997)) ([66dc9b2](https://github.com/graasp/graasp/commit/66dc9b22e561e5d3b770c6e41cc9b78ec21602cf))
* implements seed function with sample data ([#989](https://github.com/graasp/graasp/issues/989)) ([9084fe7](https://github.com/graasp/graasp/commit/9084fe75585472835242cdd1401722489db3f169))

## [1.35.0](https://github.com/graasp/graasp/compare/v1.34.0...v1.35.0) (2024-05-02)


### Features

* add route to extract link's metadata ([#1009](https://github.com/graasp/graasp/issues/1009)) ([152672d](https://github.com/graasp/graasp/commit/152672d4522af7a8779fa9cb44fe492012c98709))
* allow to create item with thumbnail ([#1002](https://github.com/graasp/graasp/issues/1002)) ([570bdf8](https://github.com/graasp/graasp/commit/570bdf83281a0500f826ba1e3eaae15898c2f4f3))


### Bug Fixes

* **deps:** update dependency luxon to v3.4.4 ([#954](https://github.com/graasp/graasp/issues/954)) ([7eb58c7](https://github.com/graasp/graasp/commit/7eb58c7b964d655d86de42545fae2b0c2c06d24d))
* **deps:** update dependency openai to v4.39.1 ([#966](https://github.com/graasp/graasp/issues/966)) ([dd5852d](https://github.com/graasp/graasp/commit/dd5852dff286a0cacdc95c11f2f03e9315d9f31f))
* **deps:** update dependency qs to v6.12.1 ([#969](https://github.com/graasp/graasp/issues/969)) ([616f909](https://github.com/graasp/graasp/commit/616f90925861501f622e1d23dd88c58ed68a18a4))
* set config.ts file import as 1st priority ([#999](https://github.com/graasp/graasp/issues/999)) ([a3518e2](https://github.com/graasp/graasp/commit/a3518e206061b3b2dc77dbd1be513ec3d0437ca3))
* **test:** set a valid url in fixtures and remove html in response ([#1010](https://github.com/graasp/graasp/issues/1010)) ([3814329](https://github.com/graasp/graasp/commit/3814329b609f67cbe7162f7aa6a7b48cbf4f67d9))
* update tests to use fastify instance type for the app var ([#1004](https://github.com/graasp/graasp/issues/1004)) ([c7b8c40](https://github.com/graasp/graasp/commit/c7b8c402bd25c14b31c65ecab4c638e7a4d9adda))

## [1.34.0](https://github.com/graasp/graasp/compare/v1.33.0...v1.34.0) (2024-04-26)


### Features

* change mobile link ([#985](https://github.com/graasp/graasp/issues/985)) ([34692e8](https://github.com/graasp/graasp/commit/34692e8013709e4634d37ac4b1a265bf78c32222))


### Bug Fixes

* include maxwidth in settings schema ([#991](https://github.com/graasp/graasp/issues/991)) ([78352fb](https://github.com/graasp/graasp/commit/78352fbeeacb8ade52ad2bf48bfa23462cd16c82))

## [1.33.0](https://github.com/graasp/graasp/compare/v1.32.0...v1.33.0) (2024-04-24)


### Features

* export all user data ([#934](https://github.com/graasp/graasp/issues/934)) ([e1c818c](https://github.com/graasp/graasp/commit/e1c818cd7be025bc1ffcc1d2b67081cf7f44a643))


### Bug Fixes

* return hidden only for writer on export ([#984](https://github.com/graasp/graasp/issues/984)) ([b73c116](https://github.com/graasp/graasp/commit/b73c11605dc2268c91fbf5a08f2401a0ed2c95fc))
* upgrade gpt versions ([#979](https://github.com/graasp/graasp/issues/979)) ([c7c5d53](https://github.com/graasp/graasp/commit/c7c5d5367f9a13cb5ba8efc88b5365f51f320029))

## [1.32.0](https://github.com/graasp/graasp/compare/v1.31.0...v1.32.0) (2024-04-23)


### Features

* allow empty display name in POST or PATCH ([#974](https://github.com/graasp/graasp/issues/974)) ([e966d6f](https://github.com/graasp/graasp/commit/e966d6fced8fdd0a1f00760b53ee20e4b65e6c62))


### Bug Fixes

* apply user name limits ([#976](https://github.com/graasp/graasp/issues/976)) ([24ea66c](https://github.com/graasp/graasp/commit/24ea66cfb6bf083b54a93fbf5d32788c9d9a1d08))
* copy item thumbnails ([#973](https://github.com/graasp/graasp/issues/973)) ([7e8894b](https://github.com/graasp/graasp/commit/7e8894b53f1f4e6c385b23bf07e30fbce6612c82))
* use () instead of [] in spaces regex ([#978](https://github.com/graasp/graasp/issues/978)) ([b415e95](https://github.com/graasp/graasp/commit/b415e95e0346e50a9ec0e35eb29817047f3d20ab))

## [1.31.0](https://github.com/graasp/graasp/compare/v1.30.0...v1.31.0) (2024-04-17)


### Features

* create delete thumbnail service and route ([#964](https://github.com/graasp/graasp/issues/964)) ([2edfccb](https://github.com/graasp/graasp/commit/2edfccbbe0ea7333019886f779f53a672ce4c261))


### Bug Fixes

* **deps:** update aws-sdk-js-v3 monorepo to v3.556.0 ([#960](https://github.com/graasp/graasp/issues/960)) ([f748047](https://github.com/graasp/graasp/commit/f74804710fd66d003c7fc272f7a9d96766290a8f))
* **deps:** update dependency @fastify/secure-session to v7.5.1 ([#950](https://github.com/graasp/graasp/issues/950)) ([a94f1dd](https://github.com/graasp/graasp/commit/a94f1dd74e738479f6b676d7b475e7dfd7a2e0fb))
* **deps:** update dependency @graasp/sdk to v4.7.2 ([#956](https://github.com/graasp/graasp/issues/956)) ([d98e1ff](https://github.com/graasp/graasp/commit/d98e1ffba79c825a0c220e7c8f4086272bef2edb))
* **deps:** update dependency fastify to v4.26.2 ([#491](https://github.com/graasp/graasp/issues/491)) ([e4bdf40](https://github.com/graasp/graasp/commit/e4bdf40b1b3183b979bf7a4f0160600efe8d746e))
* **deps:** update dependency http-status-codes to v2.3.0 ([#953](https://github.com/graasp/graasp/issues/953)) ([61fdbcc](https://github.com/graasp/graasp/commit/61fdbcc08070ea69c91034ebab86337d9fa4f18e))
* **deps:** update dependency ioredis to v5.4.0 ([#961](https://github.com/graasp/graasp/issues/961)) ([1f92252](https://github.com/graasp/graasp/commit/1f92252b34d326fef984fc847a9f32f8e2f27c5d))
* optimize get published collections for member ([#959](https://github.com/graasp/graasp/issues/959)) ([c37ccc2](https://github.com/graasp/graasp/commit/c37ccc2a8ad705693781878c103580184f5f4ca8))

## [1.30.0](https://github.com/graasp/graasp/compare/v1.29.0...v1.30.0) (2024-04-16)


### Features

* allow user to enable/disable saving actions ([#920](https://github.com/graasp/graasp/issues/920)) ([c09697c](https://github.com/graasp/graasp/commit/c09697c0e428776671a3d7bdd830aae01614781c))

## [1.29.0](https://github.com/graasp/graasp/compare/v1.28.2...v1.29.0) (2024-04-16)


### Features

* save user agreements on create and update registration mail ([#917](https://github.com/graasp/graasp/issues/917)) ([e44d641](https://github.com/graasp/graasp/commit/e44d64110d3cc6aaf996b36678deade7a3181241))


### Bug Fixes

* **arabic:** update translations ([#945](https://github.com/graasp/graasp/issues/945)) ([ec2d06e](https://github.com/graasp/graasp/commit/ec2d06e3938e460b9539fee4e217d96bc703ace1))
* **deps:** update aws-sdk-js-v3 monorepo to v3.554.0 ([#949](https://github.com/graasp/graasp/issues/949)) ([da60e92](https://github.com/graasp/graasp/commit/da60e92c9b5a82133572d506c9657797e175c789))
* **deps:** update dependency @fastify/secure-session to v7 [security] ([#936](https://github.com/graasp/graasp/issues/936)) ([5c7a1af](https://github.com/graasp/graasp/commit/5c7a1af6ac12f5ed412b425adf0cee05ef4ed70e))
* **deps:** update dependency bullmq to v4.17.0 ([#908](https://github.com/graasp/graasp/issues/908)) ([f8edb78](https://github.com/graasp/graasp/commit/f8edb781a641786b6d80485e5d4fd0459b9f23a4))
* **deps:** update dependency dotenv to v16.4.5 ([#909](https://github.com/graasp/graasp/issues/909)) ([963b371](https://github.com/graasp/graasp/commit/963b3711670f857f7142518e89be70bf659317b9))
* **deps:** update dependency eta to v2.2.0 ([#910](https://github.com/graasp/graasp/issues/910)) ([2dc9df8](https://github.com/graasp/graasp/commit/2dc9df8b5b5d679cc875412694ffc018720dd6ac))
* **deps:** update dependency fluent-json-schema to v4.2.1 ([#913](https://github.com/graasp/graasp/issues/913)) ([7dcc54f](https://github.com/graasp/graasp/commit/7dcc54f1469c4c063624148d224b9202f16051b8))
* **de:** update email translations ([#942](https://github.com/graasp/graasp/issues/942)) ([66bc24c](https://github.com/graasp/graasp/commit/66bc24c090e13ba33fa1dd56c8c3784ab1607653))
* password login should return `MemberNotSignedUp` if email has no account ([#941](https://github.com/graasp/graasp/issues/941)) ([9ffc600](https://github.com/graasp/graasp/commit/9ffc6006b34fe992fe7df5c070b7c3805af62cf7))

## [1.28.2](https://github.com/graasp/graasp/compare/v1.28.1...v1.28.2) (2024-04-09)


### Bug Fixes

* workflows again ([#930](https://github.com/graasp/graasp/issues/930)) ([5dee519](https://github.com/graasp/graasp/commit/5dee5191e65033d3067cda26fb02d94c26633963))

## [1.28.1](https://github.com/graasp/graasp/compare/v1.28.0...v1.28.1) (2024-04-09)


### Bug Fixes

* add poolsize in env ([#931](https://github.com/graasp/graasp/issues/931)) ([45e1a80](https://github.com/graasp/graasp/commit/45e1a805e676360194bdd954dd4274fc8e14a55e))

## [1.28.0](https://github.com/graasp/graasp/compare/v1.27.0...v1.28.0) (2024-04-08)


### Features

* add auth from mobile to web ([#921](https://github.com/graasp/graasp/issues/921)) ([dfbde8e](https://github.com/graasp/graasp/commit/dfbde8e7f8b935e2cc64a283f911504c974e5ccd))
* import users with CSV and create file structure based on groups in CSV ([#700](https://github.com/graasp/graasp/issues/700)) ([410dbd8](https://github.com/graasp/graasp/commit/410dbd8f7805a01c8fec83313c80b399be30fbb3))


### Bug Fixes

* flacky websockets test ([#927](https://github.com/graasp/graasp/issues/927)) ([f83537f](https://github.com/graasp/graasp/commit/f83537fab69d2238e8eda8539a514eb71b07d880))
* update deploy workflows to use the tag instead of main when checkout ([#926](https://github.com/graasp/graasp/issues/926)) ([93d8790](https://github.com/graasp/graasp/commit/93d879045568220ac57580591b6617002b3b7c04))

## [1.27.0](https://github.com/graasp/graasp/compare/v1.26.0...v1.27.0) (2024-04-05)


### Features

* add display name column ([#891](https://github.com/graasp/graasp/issues/891)) ([66b454d](https://github.com/graasp/graasp/commit/66b454da24a985dca9d5f1fb857a19fa3d69352c))

## [1.26.0](https://github.com/graasp/graasp/compare/v1.25.0...v1.26.0) (2024-04-04)


### Features

* increase pool size ([#916](https://github.com/graasp/graasp/issues/916)) ([5a884fc](https://github.com/graasp/graasp/commit/5a884fc08c18aa44e3338f92e160f223419c7f52))


### Bug Fixes

* **deps:** update dependency @fastify/secure-session to v6.2.0 ([#898](https://github.com/graasp/graasp/issues/898)) ([793f87a](https://github.com/graasp/graasp/commit/793f87aa0acca33240773065d5f1a1ae490f2669))
* do not expose ports that are not necessary ([#911](https://github.com/graasp/graasp/issues/911)) ([930b7d4](https://github.com/graasp/graasp/commit/930b7d4099836fb6467eefca3be37c71e9b07443))

## [1.25.0](https://github.com/graasp/graasp/compare/v1.24.1...v1.25.0) (2024-03-26)


### Features

* add helper label for geoloc ([#877](https://github.com/graasp/graasp/issues/877)) ([eea9b2d](https://github.com/graasp/graasp/commit/eea9b2d3525573f1ffbe6b7a563ee62e2786055a))
* add more status reports on `/status` ([#887](https://github.com/graasp/graasp/issues/887)) ([b09a89d](https://github.com/graasp/graasp/commit/b09a89d077c2de541d952156fe948c11f8544848))
* return permission alongside item ([#871](https://github.com/graasp/graasp/issues/871)) ([94e1848](https://github.com/graasp/graasp/commit/94e1848091e386edaf8913f595e28c414244b44d))


### Bug Fixes

* add CORS on status endpoint ([#897](https://github.com/graasp/graasp/issues/897)) ([6ae3570](https://github.com/graasp/graasp/commit/6ae3570d8a7cd7293de4fafdf511ee424360e3a7))
* **deps:** update dependency @fastify/bearer-auth to v9.4.0 ([#896](https://github.com/graasp/graasp/issues/896)) ([1fd17c5](https://github.com/graasp/graasp/commit/1fd17c5dc567a588b03f26bca69a0897b20459ea))
* **deps:** update dependency @fastify/static to v6.12.0 ([#899](https://github.com/graasp/graasp/issues/899)) ([08adc4e](https://github.com/graasp/graasp/commit/08adc4e884d6603cee023bc7e28973d3c8428d8c))
* **deps:** update dependency geoip-lite to v1.4.10 ([#712](https://github.com/graasp/graasp/issues/712)) ([6007e31](https://github.com/graasp/graasp/commit/6007e312d648c150cb96afe870e75d08049c81e7))
* do not expose port 1025 to the local machine ([#903](https://github.com/graasp/graasp/issues/903)) ([6d81802](https://github.com/graasp/graasp/commit/6d818023ee8f28e0e25603277dcdc67a30f329c5))
* keep lang on copy ([#906](https://github.com/graasp/graasp/issues/906)) ([925528a](https://github.com/graasp/graasp/commit/925528af3f50e16085cbebecccde7df6b5490e55))
* update sytax for set-output ([#890](https://github.com/graasp/graasp/issues/890)) ([d5c09a0](https://github.com/graasp/graasp/commit/d5c09a001ed9b75a66571d2b3fc82bdf6d2d854e))

## [1.24.1](https://github.com/graasp/graasp/compare/v1.24.0...v1.24.1) (2024-03-20)


### Bug Fixes

* **arabic:** translate ([#883](https://github.com/graasp/graasp/issues/883)) ([19f4e59](https://github.com/graasp/graasp/commit/19f4e59c273ab3152f09a5a7e531a71ea73700e0))
* **ci:** add merge group ([#884](https://github.com/graasp/graasp/issues/884)) ([c197364](https://github.com/graasp/graasp/commit/c1973649a454b0cf7602a3131c3a49626900d24d))
* export h5p in zip ([#874](https://github.com/graasp/graasp/issues/874)) ([a08c0a1](https://github.com/graasp/graasp/commit/a08c0a19ee25903e6c6fe2c3560bd3325890d028))
* **german:** update footer translations ([#882](https://github.com/graasp/graasp/issues/882)) ([a181ba1](https://github.com/graasp/graasp/commit/a181ba13c05ee03800b6510ac4db6a57cb0bf682))
* return null when public profile is not visible ([#886](https://github.com/graasp/graasp/issues/886)) ([b369ead](https://github.com/graasp/graasp/commit/b369ead00b03dd76295c28e3bfb650206f2b3174))
* **spanish:** update footer translations ([#881](https://github.com/graasp/graasp/issues/881)) ([d24094f](https://github.com/graasp/graasp/commit/d24094fd8a251ea8286a5e390ed7307875636355))

## [1.24.0](https://github.com/graasp/graasp/compare/v1.23.0...v1.24.0) (2024-03-13)


### Features

* translate footer of emails ([#872](https://github.com/graasp/graasp/issues/872)) ([e81a7b5](https://github.com/graasp/graasp/commit/e81a7b55a4674edd5c3c353eaef464aa047aa2e7))


### Bug Fixes

* add showLinkIframe and showLinkButton in settings with tests ([#878](https://github.com/graasp/graasp/issues/878)) ([5663bf1](https://github.com/graasp/graasp/commit/5663bf1605cc464082bd0bc035e3f72dcb423ba0))

## [1.23.0](https://github.com/graasp/graasp/compare/v1.22.0...v1.23.0) (2024-03-12)


### Features

* add geoloc keys in deploy workflows ([#869](https://github.com/graasp/graasp/issues/869)) ([e4691d9](https://github.com/graasp/graasp/commit/e4691d9da9b87552b7f2f976b826ae78cd2cd7a7))

## [1.22.0](https://github.com/graasp/graasp/compare/v1.21.0...v1.22.0) (2024-03-12)


### Features

* add geocoding endpoints ([#856](https://github.com/graasp/graasp/issues/856)) ([5af0639](https://github.com/graasp/graasp/commit/5af0639c159267c18a9377d0bda88ad60036e366))
* use item id for actions ([#867](https://github.com/graasp/graasp/issues/867)) ([c421af6](https://github.com/graasp/graasp/commit/c421af6dbbad9b4ed649524e42862d952134dcdb))

## [1.21.0](https://github.com/graasp/graasp/compare/v1.20.1...v1.21.0) (2024-03-07)


### Features

* add descriptionPlacement in the fluent setting schema ([d1228df](https://github.com/graasp/graasp/commit/d1228df469a5041d59cb948d30c59e7898916180))
* add descriptionPlacement support in item settings ([#852](https://github.com/graasp/graasp/issues/852)) ([d1228df](https://github.com/graasp/graasp/commit/d1228df469a5041d59cb948d30c59e7898916180))
* allow members with read access to post app data for another member ([#863](https://github.com/graasp/graasp/issues/863)) ([5349541](https://github.com/graasp/graasp/commit/534954175a8f4b2c7ab64cf693a390cf5b761b5f))
* filter out additionnal properties in settings using schema ([d1228df](https://github.com/graasp/graasp/commit/d1228df469a5041d59cb948d30c59e7898916180))
* set default hasThumbnail even if settings are defined in create item ([d1228df](https://github.com/graasp/graasp/commit/d1228df469a5041d59cb948d30c59e7898916180))


### Bug Fixes

* add missing settings attributes in the fluent schema ([d1228df](https://github.com/graasp/graasp/commit/d1228df469a5041d59cb948d30c59e7898916180))
* order descendants by default ([#861](https://github.com/graasp/graasp/issues/861)) ([eda8f5c](https://github.com/graasp/graasp/commit/eda8f5c24f4e9eaa001108a366f288259f4edf44))

## [1.20.1](https://github.com/graasp/graasp/compare/v1.20.0...v1.20.1) (2024-03-04)


### Bug Fixes

* **deps:** update dependency @fastify/auth to v4.6.1 ([#803](https://github.com/graasp/graasp/issues/803)) ([1e9a697](https://github.com/graasp/graasp/commit/1e9a697a32bf9de9b65c15038d7b03a6a85d47f0))
* **deps:** update dependency sanitize-html to v2.12.1 [security] ([#853](https://github.com/graasp/graasp/issues/853)) ([05ed9e5](https://github.com/graasp/graasp/commit/05ed9e5b71d5f28d75ebc5f8ab71cc8b46c9b95b))
* reuse item login from parent ([#855](https://github.com/graasp/graasp/issues/855)) ([1fe3ba5](https://github.com/graasp/graasp/commit/1fe3ba5ef2423e7c6594bba3e1ae3f08b0bf1272))
* small issues and add greeting ([#848](https://github.com/graasp/graasp/issues/848)) ([8714a54](https://github.com/graasp/graasp/commit/8714a5452cbf9daf702bf55476a521e6b7cced16))
* update readme with &lt;secret-key&gt; where we need to generate keys ([2dd4aac](https://github.com/graasp/graasp/commit/2dd4aac246963bc836f19a975f22d2842079b172))

## [1.20.0](https://github.com/graasp/graasp/compare/v1.19.0...v1.20.0) (2024-02-27)


### Features

* translate it.json via GitLocalize ([#832](https://github.com/graasp/graasp/issues/832)) ([3c7b08d](https://github.com/graasp/graasp/commit/3c7b08d4b6e8c6f5a517908ec164401e38780969))


### Bug Fixes

* local file bugs and add a localfiles server ([#843](https://github.com/graasp/graasp/issues/843)) ([a42ded9](https://github.com/graasp/graasp/commit/a42ded9f8288d0e3836d254d8b80682e32d53a21))
* update dev deps ([#829](https://github.com/graasp/graasp/issues/829)) ([4c5f881](https://github.com/graasp/graasp/commit/4c5f88159a7ca294cc6cda0eb48db979e6019f3d))
* use sdk esm version ([#838](https://github.com/graasp/graasp/issues/838)) ([8a164b2](https://github.com/graasp/graasp/commit/8a164b24a2e3ebf649a83e24ef84b9ab225810b8))


### Tests

* add test for action services ([#839](https://github.com/graasp/graasp/issues/839)) ([3121004](https://github.com/graasp/graasp/commit/3121004fd860f5faa3dba47f62d06494e9a3e2b4))

## [1.19.0](https://github.com/graasp/graasp/compare/v1.18.0...v1.19.0) (2024-02-20)


### Features

* get geolocation within item, provide addressLabel ([#814](https://github.com/graasp/graasp/issues/814)) ([759f2e6](https://github.com/graasp/graasp/commit/759f2e6fedd78d57199fc754c89a1cef2852dfb6))


### Bug Fixes

* return 200 with `null` when item is not published instead of error ([#819](https://github.com/graasp/graasp/issues/819)) ([35d77f6](https://github.com/graasp/graasp/commit/35d77f610fae41bbbfa1c2baef17c1c855b2e04b))
* **spanish:** update translations ([#827](https://github.com/graasp/graasp/issues/827)) ([557942c](https://github.com/graasp/graasp/commit/557942c0a65c7dd4f3a8499751aee40352d544e8))
* update sdk dep and schemas ([#828](https://github.com/graasp/graasp/issues/828)) ([f9efa8c](https://github.com/graasp/graasp/commit/f9efa8ccf5fbf27522ea692dc41210e948bab75f))


### Documentation

* testing env and localstack issues ([#822](https://github.com/graasp/graasp/issues/822)) ([2f33472](https://github.com/graasp/graasp/commit/2f33472d78b77fa99b9a56c00290d717222a21e5))

## [1.18.0](https://github.com/graasp/graasp/compare/v1.17.1...v1.18.0) (2024-02-13)


### Features

* translate es.json via GitLocalize ([#810](https://github.com/graasp/graasp/issues/810)) ([4354cc9](https://github.com/graasp/graasp/commit/4354cc9ec96373ec4b441b3115f715f3a6ce8dba))
* translate it.json via GitLocalize ([#809](https://github.com/graasp/graasp/issues/809)) ([8522dbc](https://github.com/graasp/graasp/commit/8522dbc4c0fab1f148b8463c0281629e6ec99bbb))


### Bug Fixes

* update iframely env var and package author ([#815](https://github.com/graasp/graasp/issues/815)) ([6d0400a](https://github.com/graasp/graasp/commit/6d0400a312e9dbacf9ee5ce310c682aadf202e49))
* update readme values ([#812](https://github.com/graasp/graasp/issues/812)) ([35ccfd4](https://github.com/graasp/graasp/commit/35ccfd406dcba0229cc4b41b49250b96a6f056ee))
* use https in schemas ([#816](https://github.com/graasp/graasp/issues/816)) ([75658dd](https://github.com/graasp/graasp/commit/75658dd676498ea94bb1f6a3d210cac780fffdb3))


### Documentation

* add badges to readme ([#807](https://github.com/graasp/graasp/issues/807)) ([97a6b97](https://github.com/graasp/graasp/commit/97a6b977149cfdb69fd3d9062985ed3b77d9cad4))

## [1.17.1](https://github.com/graasp/graasp/compare/v1.17.0...v1.17.1) (2024-02-05)


### Bug Fixes

* **deps:** update dependency @fastify/bearer-auth to v9.3.0 ([#785](https://github.com/graasp/graasp/issues/785)) ([bcd9fae](https://github.com/graasp/graasp/commit/bcd9faef9a9038643a04117850c87cf608e1234a))
* filter out recycled items on get geolocation ([#805](https://github.com/graasp/graasp/issues/805)) ([77c63cf](https://github.com/graasp/graasp/commit/77c63cf8db97519dd45e056d8a9a5819f5e70a85))
* use member and item factories, set lang in i18n ([#790](https://github.com/graasp/graasp/issues/790)) ([b52aac9](https://github.com/graasp/graasp/commit/b52aac9b7f6c8a3092c0e1c938e4c02a3acbea04))

## [1.17.0](https://github.com/graasp/graasp/compare/v1.16.0...v1.17.0) (2024-02-01)


### Features

* add search for geolocation endpoint ([#798](https://github.com/graasp/graasp/issues/798)) ([5d8ae03](https://github.com/graasp/graasp/commit/5d8ae03c9986d78a7358fe52a120dbfa0d0b2552))
* allow to filter out item by type in accessible ([#793](https://github.com/graasp/graasp/issues/793)) ([3e817f2](https://github.com/graasp/graasp/commit/3e817f2dd02a8e93dff1b5a84c2923636dfd67d1))


### Bug Fixes

* add release tag to build step and docker image ([#792](https://github.com/graasp/graasp/issues/792)) ([276e51a](https://github.com/graasp/graasp/commit/276e51a76b5197a4f10350bf77290b19116a96fb))
* console logs missing from the NonException PR ([276e51a](https://github.com/graasp/graasp/commit/276e51a76b5197a4f10350bf77290b19116a96fb))
* **deps:** update dependency @fastify/auth to v4.4.0 ([#469](https://github.com/graasp/graasp/issues/469)) ([6d73f81](https://github.com/graasp/graasp/commit/6d73f8129dd04a9d2ac3dda6907f40e710e5ef35))

## [1.16.0](https://github.com/graasp/graasp/compare/v1.15.0...v1.16.0) (2024-01-29)


### Features

* add geolocation endpoints ([#777](https://github.com/graasp/graasp/issues/777)) ([415d4c1](https://github.com/graasp/graasp/commit/415d4c1869c2aecb9d25c8b8d2196bbb39683604))


### Bug Fixes

* throw if item is not folder for copy, move and post ([#786](https://github.com/graasp/graasp/issues/786)) ([81c70a5](https://github.com/graasp/graasp/commit/81c70a5d263f4b77d6891226652ba4b30cd9d93b))

## [1.15.0](https://github.com/graasp/graasp/compare/v1.14.1...v1.15.0) (2024-01-25)


### Features

* filter accessible items by permission ([#762](https://github.com/graasp/graasp/issues/762)) ([c453ba5](https://github.com/graasp/graasp/commit/c453ba5c0a9f05a665f3e0bbe3847e722af6888d))
* include app data, setting and actions in analytics ([#752](https://github.com/graasp/graasp/issues/752)) ([b4ac8c7](https://github.com/graasp/graasp/commit/b4ac8c76278d2209e35d21a55a0a80f90000f88f))


### Bug Fixes

* add mail translations and fix mention translations in mail ([#779](https://github.com/graasp/graasp/issues/779)) ([0664f7d](https://github.com/graasp/graasp/commit/0664f7db8df3e4b1d2c5010a5d13246bacd90902))
* **deps:** update dependency @fastify/cors to v8.5.0 ([#473](https://github.com/graasp/graasp/issues/473)) ([ed468e8](https://github.com/graasp/graasp/commit/ed468e82f0d9ab62b493d1c67f125c82b652d8ec))
* **deps:** update dependency @graasp/translations to v1.21.1 ([#710](https://github.com/graasp/graasp/issues/710)) ([391e047](https://github.com/graasp/graasp/commit/391e0479aabf92a64f2363fe1b86c6ffacb311f3))
* **deps:** update dependency bcrypt to v5.1.1 ([af69cf1](https://github.com/graasp/graasp/commit/af69cf127fa28424275c7c38d8108fd11de4e64e))
* **deps:** update dependency fastify-plugin to v4.5.1 ([52f7206](https://github.com/graasp/graasp/commit/52f7206841591e76506046075f1edead692b8f08))
* **deps:** update dependency typeorm to v0.3.19 ([#774](https://github.com/graasp/graasp/issues/774)) ([30e184b](https://github.com/graasp/graasp/commit/30e184b95b506f46f11c65885c6afed8f91cfa53))
* flacky recycle feedback test ([#784](https://github.com/graasp/graasp/issues/784)) ([8fa68bf](https://github.com/graasp/graasp/commit/8fa68bf6d5fda574ef50ff283c185923ba8a4594))
* handle better S3 NotFound errors and return them as such ([#649](https://github.com/graasp/graasp/issues/649)) ([63b5b95](https://github.com/graasp/graasp/commit/63b5b95fe1800081996bd8a81f95174337266d49))
* normalise invitation email ([#771](https://github.com/graasp/graasp/issues/771)) ([f29e350](https://github.com/graasp/graasp/commit/f29e350fbb1153650adf44cf9165df4d75c3ed6e))
* return creator for item in favorite ([#782](https://github.com/graasp/graasp/issues/782)) ([097314b](https://github.com/graasp/graasp/commit/097314b9e887ccef3bf4e40e7a8a43a7f94ed300))
* **test:** add test to check s3 not found error ([63b5b95](https://github.com/graasp/graasp/commit/63b5b95fe1800081996bd8a81f95174337266d49))
* use WEBP format for thumbnails and update sizes ([#776](https://github.com/graasp/graasp/issues/776)) ([de94be9](https://github.com/graasp/graasp/commit/de94be9f96e35daddf9e6cff697c57f09f675cf4))

## [1.14.1](https://github.com/graasp/graasp/compare/v1.14.0...v1.14.1) (2024-01-18)


### Bug Fixes

* add dummy bad words validation ([#763](https://github.com/graasp/graasp/issues/763)) ([8ccb3d6](https://github.com/graasp/graasp/commit/8ccb3d60816e59c3e88b6d12446af3676f9eaeab))
* add nudenet container in devcontainer ([8ccb3d6](https://github.com/graasp/graasp/commit/8ccb3d60816e59c3e88b6d12446af3676f9eaeab))
* disable bad words validation ([#755](https://github.com/graasp/graasp/issues/755)) ([ae29565](https://github.com/graasp/graasp/commit/ae29565de8d925657a64ca2905e2003be0800f7d))
* do not fail login with password if score is low ([#757](https://github.com/graasp/graasp/issues/757)) ([cee9574](https://github.com/graasp/graasp/commit/cee95741d1e32514b5dfb1748ef42702174b0303))
* **test:** fix flacky tests ([ae29565](https://github.com/graasp/graasp/commit/ae29565de8d925657a64ca2905e2003be0800f7d))
* update sdk with removed etherpad api dep ([#753](https://github.com/graasp/graasp/issues/753)) ([9b08705](https://github.com/graasp/graasp/commit/9b08705d4062bb65c1019124349b5c279f70ae2a))

## [1.14.0](https://github.com/graasp/graasp/compare/v1.13.2...v1.14.0) (2024-01-12)


### Features

* import html and txt files ([#751](https://github.com/graasp/graasp/issues/751)) ([4f40f21](https://github.com/graasp/graasp/commit/4f40f2171adaa645b4431a9e6409ae731ea0fc18))


### Bug Fixes

* add logger to FileService ([#740](https://github.com/graasp/graasp/issues/740)) ([4c05f8e](https://github.com/graasp/graasp/commit/4c05f8e573d34aba871f034e75aca97cee9200c5))

## [1.13.2](https://github.com/graasp/graasp/compare/v1.13.1...v1.13.2) (2024-01-08)


### Bug Fixes

* add transaction in import post ([#746](https://github.com/graasp/graasp/issues/746)) ([8bf0ca1](https://github.com/graasp/graasp/commit/8bf0ca1a1cf0f3e3b617b91ac4e6a3bc4e2cbcd1))

## [1.13.1](https://github.com/graasp/graasp/compare/v1.13.0...v1.13.1) (2024-01-08)


### Bug Fixes

* return shared child in accessible items ([#737](https://github.com/graasp/graasp/issues/737)) ([b68a443](https://github.com/graasp/graasp/commit/b68a443ce18c2ad7e8511399eac1a98d6f8a7b1a))

## [1.13.0](https://github.com/graasp/graasp/compare/v1.12.0...v1.13.0) (2023-12-22)


### Features

* add get accessible items endpoint ([#709](https://github.com/graasp/graasp/issues/709)) ([927a44e](https://github.com/graasp/graasp/commit/927a44e683f619f22fff6d7b6fcdbb86716432f3))


### Bug Fixes

* add log for zip ([#735](https://github.com/graasp/graasp/issues/735)) ([8b44341](https://github.com/graasp/graasp/commit/8b44341f2d7330c95326b9b555cb4b6bff4ad781))

## [1.12.0](https://github.com/graasp/graasp/compare/v1.11.1...v1.12.0) (2023-12-19)


### Features

* allow to query app settings by name ([#725](https://github.com/graasp/graasp/issues/725)) ([961a8fa](https://github.com/graasp/graasp/commit/961a8fa5e72c47f414c9f9851f3cdd00fe445d5b))
* implement the get short link route ([#717](https://github.com/graasp/graasp/issues/717)) ([3cb7d9f](https://github.com/graasp/graasp/commit/3cb7d9f422dc1df23e25130ed3850dd9447db840))


### Bug Fixes

* **deps:** update dependency uuid to v9.0.1 ([#713](https://github.com/graasp/graasp/issues/713)) ([9c5700c](https://github.com/graasp/graasp/commit/9c5700cd0a7db477bf977d58cef021c341582d5a))
* fix lint errors, add logging for import zip ([#727](https://github.com/graasp/graasp/issues/727)) ([f85d93d](https://github.com/graasp/graasp/commit/f85d93d2cdb868b41dcd0ca82927f42045e5537c))

## [1.11.1](https://github.com/graasp/graasp/compare/v1.11.0...v1.11.1) (2023-12-12)


### Bug Fixes

* **deps:** update dependency @fastify/multipart to v7.7.3 ([#474](https://github.com/graasp/graasp/issues/474)) ([b41679b](https://github.com/graasp/graasp/commit/b41679b221a77f17718217d37c63d0f074377a1d))
* **deps:** update dependency fluent-json-schema to v4.1.2 ([27c1bdc](https://github.com/graasp/graasp/commit/27c1bdcfbdd26c9c6305444d2fd9614905b7aa16))
* **deps:** update dependency jsonwebtoken to v9.0.2 ([5b9a6cf](https://github.com/graasp/graasp/commit/5b9a6cfac78e67e2491c22fd67c8e953803eef22))
* remove yarn dependency ([#715](https://github.com/graasp/graasp/issues/715)) ([f5cbfc6](https://github.com/graasp/graasp/commit/f5cbfc6447ae131ac97a839e45b0e5c76b9e2b92))
* wrong env used in deploy job ([#721](https://github.com/graasp/graasp/issues/721)) ([70bdf02](https://github.com/graasp/graasp/commit/70bdf027d3b6fa25b7feef76a39219b8d945b3a8))

## [1.11.0](https://github.com/graasp/graasp/compare/v1.10.1...v1.11.0) (2023-12-01)


### Features

* add action triggers to download item, like, unlike, search item ([#667](https://github.com/graasp/graasp/issues/667)) ([05e9f58](https://github.com/graasp/graasp/commit/05e9f58e0ab5886f85052a24e2cbeaff6f4458d3))
* add short links routes ([#664](https://github.com/graasp/graasp/issues/664)) ([#672](https://github.com/graasp/graasp/issues/672)) ([d084c8e](https://github.com/graasp/graasp/commit/d084c8edec130983b72ee6c7032d145c84c57e61))


### Bug Fixes

* add missing client hosts and move workflows back here ([#687](https://github.com/graasp/graasp/issues/687)) ([c3baa3b](https://github.com/graasp/graasp/commit/c3baa3b403f86c2a206de87c458b33211e91f66f))
* **app:** use correct authentication method to deliver context ([#632](https://github.com/graasp/graasp/issues/632)) ([0ff069c](https://github.com/graasp/graasp/commit/0ff069ca14823b579a8a989170bbf7d8077426e0))
* rename workflows ([#705](https://github.com/graasp/graasp/issues/705)) ([e48b54b](https://github.com/graasp/graasp/commit/e48b54b9d434c75223adc2175700315c812fafea))

## [1.10.1](https://github.com/graasp/graasp/compare/v1.10.0...v1.10.1) (2023-11-24)


### Bug Fixes

* bump version of reusable workflow ([d881cbe](https://github.com/graasp/graasp/commit/d881cbeb65fe70d491aa39a58ff58c1f2a16a7ed))

## [1.10.0](https://github.com/graasp/graasp/compare/v1.9.5...v1.10.0) (2023-11-24)


### Features

* add a chatbot endpoint for apps ([#641](https://github.com/graasp/graasp/issues/641)) ([#657](https://github.com/graasp/graasp/issues/657)) ([775c721](https://github.com/graasp/graasp/commit/775c721d49e16786082bbe543b136f36d38dfff6))


### Bug Fixes

* **deps:** update dependency sharp to v0.32.6 [security] ([#698](https://github.com/graasp/graasp/issues/698)) ([0dfe469](https://github.com/graasp/graasp/commit/0dfe469edeb37fceba963147972e628decc1e84d))
* move back files from sdk ([#697](https://github.com/graasp/graasp/issues/697)) ([2bb7d46](https://github.com/graasp/graasp/commit/2bb7d462b41d931687e678457cfd87ee40f571bc))
* update aws file for prod deploy ([#702](https://github.com/graasp/graasp/issues/702)) ([6034a9e](https://github.com/graasp/graasp/commit/6034a9e3754e61ef5336baade577238cdcd363dd))

## [1.9.5](https://github.com/graasp/graasp/compare/v1.9.4...v1.9.5) (2023-11-14)


### Bug Fixes

* use version 1.22.1 of deploy callee ([18f9d44](https://github.com/graasp/graasp/commit/18f9d44427839c289d0190a08a447946693b0389))

## [1.9.4](https://github.com/graasp/graasp/compare/v1.9.3...v1.9.4) (2023-11-09)


### Bug Fixes

* add regression test for legacy folder extra ([7615319](https://github.com/graasp/graasp/commit/7615319014c54915982603e53ba6ae1bf0f1cabb))
* allow public access to ws ([#683](https://github.com/graasp/graasp/issues/683)) ([d7c3a48](https://github.com/graasp/graasp/commit/d7c3a48a207a2a523da8cf085e0235c0ad95015e))
* create getUrl and getFile in file repository ([#684](https://github.com/graasp/graasp/issues/684)) ([839189d](https://github.com/graasp/graasp/commit/839189d58dcd7aa5828b6c8f950381a99b5b7b65))
* **deps:** update dependency @graasp/translations to v1.15.1 ([#511](https://github.com/graasp/graasp/issues/511)) ([2110dbc](https://github.com/graasp/graasp/commit/2110dbc44511aba376a591b9216f379e62228d3d))
* **deps:** update dependency archiver to v5.3.2 ([#593](https://github.com/graasp/graasp/issues/593)) ([ac346f7](https://github.com/graasp/graasp/commit/ac346f70a8a498077f2edd682ba9842108a68a64))
* filter sentry events at the source ([#673](https://github.com/graasp/graasp/issues/673)) ([27e290e](https://github.com/graasp/graasp/commit/27e290ededcf123e55deff3f775a0338823a4ebd))
* update to sdk 2.0.0 ([#680](https://github.com/graasp/graasp/issues/680)) ([7615319](https://github.com/graasp/graasp/commit/7615319014c54915982603e53ba6ae1bf0f1cabb))
* use optional on folder extra that might be empty ([#679](https://github.com/graasp/graasp/issues/679)) ([7615319](https://github.com/graasp/graasp/commit/7615319014c54915982603e53ba6ae1bf0f1cabb))

## [1.9.3](https://github.com/graasp/graasp/compare/v1.9.2...v1.9.3) (2023-10-26)


### Bug Fixes

* add childrenOrder extra on folder in import-zip ([682d9d7](https://github.com/graasp/graasp/commit/682d9d70fe7c42b6978efb440d60914786bdb7f3))
* add missing relations in appSettings ([#653](https://github.com/graasp/graasp/issues/653)) ([7c96923](https://github.com/graasp/graasp/commit/7c9692366045c845f15527b89037d481cbf80459))
* add test about childrenorder updated in parent ([682d9d7](https://github.com/graasp/graasp/commit/682d9d70fe7c42b6978efb440d60914786bdb7f3))
* **internal:** better type safety ([#580](https://github.com/graasp/graasp/issues/580)) ([682d9d7](https://github.com/graasp/graasp/commit/682d9d70fe7c42b6978efb440d60914786bdb7f3))
* relax test on etherpad cookie length ([682d9d7](https://github.com/graasp/graasp/commit/682d9d70fe7c42b6978efb440d60914786bdb7f3))
* set member id on post app data ([#662](https://github.com/graasp/graasp/issues/662)) ([ba04a22](https://github.com/graasp/graasp/commit/ba04a220cdea08d7fa61e69eb7d82f2d81989fa0))
* use node18 and const ItemType ([682d9d7](https://github.com/graasp/graasp/commit/682d9d70fe7c42b6978efb440d60914786bdb7f3))
* use typequards and better typing for Item to improve type-safety ([682d9d7](https://github.com/graasp/graasp/commit/682d9d70fe7c42b6978efb440d60914786bdb7f3))

## [1.9.2](https://github.com/graasp/graasp/compare/v1.9.1...v1.9.2) (2023-10-25)


### Bug Fixes

* add item.creator in getItemLike for member response ([#644](https://github.com/graasp/graasp/issues/644)) ([4e06957](https://github.com/graasp/graasp/commit/4e06957943c236cdb625bcfa14d4bd92cac4c1d5))
* add local test db ([#655](https://github.com/graasp/graasp/issues/655)) ([6cf61cc](https://github.com/graasp/graasp/commit/6cf61cc1a0e39814e3282da9f7d0444d0acfee76))


### Documentation

* update readme instructions for localstack ([#652](https://github.com/graasp/graasp/issues/652)) ([a455f14](https://github.com/graasp/graasp/commit/a455f14432a5d31daddc033f328d0bc223a34958)), closes [#650](https://github.com/graasp/graasp/issues/650)

## [1.9.1](https://github.com/graasp/graasp/compare/v1.9.0...v1.9.1) (2023-10-19)


### Bug Fixes

* update staging aws deployment file ([#656](https://github.com/graasp/graasp/issues/656)) ([915c698](https://github.com/graasp/graasp/commit/915c6982568fa48bb6d368bf14831124a9d135e9))

## [1.9.0](https://github.com/graasp/graasp/compare/v1.8.0...v1.9.0) (2023-10-16)


### Features

* add indices on action entity ([#623](https://github.com/graasp/graasp/issues/623)) ([83d5cb0](https://github.com/graasp/graasp/commit/83d5cb06bc5daa1ec5c397d30dca7d11063d1ae9))
* add websockets feedbacks ([#552](https://github.com/graasp/graasp/issues/552)) ([c253fb7](https://github.com/graasp/graasp/commit/c253fb7b258280e7ff94964a66705be518ed0e28))


### Bug Fixes

* **types:** fileStream argument has incompatible typing ([#640](https://github.com/graasp/graasp/issues/640)) ([07269bf](https://github.com/graasp/graasp/commit/07269bf95f293c3197cec2faf8f34677b8bcd504))
* **typo:** import Readable as named ([#645](https://github.com/graasp/graasp/issues/645)) ([e4d44c4](https://github.com/graasp/graasp/commit/e4d44c411be82355d5e12ea24422111301ca086b))
* use limit and offset for meilisearch pagination ([#630](https://github.com/graasp/graasp/issues/630)) ([20d5979](https://github.com/graasp/graasp/commit/20d59793c97ccf3beb83fb8be6cb7af94d0bdd98))

## [1.8.0](https://github.com/graasp/graasp/compare/v1.7.0...v1.8.0) (2023-09-28)


### Features

* implement get current member storage ([#576](https://github.com/graasp/graasp/issues/576)) ([3289c71](https://github.com/graasp/graasp/commit/3289c71ae72ca0621332ad849921c55bd91f9b98))
* improve meilisearch integration resiliency ([#625](https://github.com/graasp/graasp/issues/625)) ([11a3064](https://github.com/graasp/graasp/commit/11a3064008ae6cbe8705792c45f3b2eb362d4a5d))


### Bug Fixes

* order parents ([#614](https://github.com/graasp/graasp/issues/614)) ([a575231](https://github.com/graasp/graasp/commit/a57523142e5fc3f2b82b15ecd95e5c265da8770f))


### Documentation

* add etherpad plugin documentation ([#601](https://github.com/graasp/graasp/issues/601)) ([d2dfa65](https://github.com/graasp/graasp/commit/d2dfa65948cada2f1d2c01f32460fb66d96293c9))
* copy app docs ([#620](https://github.com/graasp/graasp/issues/620)) ([e02cb21](https://github.com/graasp/graasp/commit/e02cb2186b513673d74dca70c3159037e3a0ddb1))

## [1.7.0](https://github.com/graasp/graasp/compare/v1.6.1...v1.7.0) (2023-09-21)


### Features

* handle redirection url in auth endpoints ([#600](https://github.com/graasp/graasp/issues/600)) ([522c1b8](https://github.com/graasp/graasp/commit/522c1b8f0844cf8289af1ae02b6e1666a0027bb2))
* Meilisearch integration ([#588](https://github.com/graasp/graasp/issues/588)) ([3affad3](https://github.com/graasp/graasp/commit/3affad300db9ef9c0e180de70bc12f387309cca6))

## [1.6.1](https://github.com/graasp/graasp/compare/v1.6.0...v1.6.1) (2023-09-07)


### Bug Fixes

* align file name truncation with item name limit ([#590](https://github.com/graasp/graasp/issues/590)) ([aecdb90](https://github.com/graasp/graasp/commit/aecdb905427c1f918b968d3c3dcba45d537852cd))
* fix library link in email ([#595](https://github.com/graasp/graasp/issues/595)) ([135393c](https://github.com/graasp/graasp/commit/135393ca4a044b831ee7a00d846f0664dae877c3))
* remove im's create function, notify on post ([#584](https://github.com/graasp/graasp/issues/584)) ([db2f79b](https://github.com/graasp/graasp/commit/db2f79ba411dff9825bb3cfcd257341cdf509521))
* sort tree for copy process ([#581](https://github.com/graasp/graasp/issues/581)) ([0f982fa](https://github.com/graasp/graasp/commit/0f982fa7f4a4e7d8997fe301fbf83bf8c40ca9a7))
* use custom deep link protocol for mobile login password response ([#596](https://github.com/graasp/graasp/issues/596)) ([637abf4](https://github.com/graasp/graasp/commit/637abf4f1ed61a536d29d8cc9354e3951abe7f74))

## [1.6.0](https://github.com/graasp/graasp/compare/v1.5.0...v1.6.0) (2023-08-25)


### Features

* add italian and arabic categories, refactor categories name ([#570](https://github.com/graasp/graasp/issues/570)) ([da44eec](https://github.com/graasp/graasp/commit/da44eeccb4d9cc216e2c6b37ca6a6bff697f5a70))
* add post action endpoint ([#541](https://github.com/graasp/graasp/issues/541)) ([7b62f98](https://github.com/graasp/graasp/commit/7b62f9893c8706cf850098450d3fbf9fd971d6ea))


### Bug Fixes

* **deps:** update aws-sdk-js-v3 monorepo to v3.395.0 ([#421](https://github.com/graasp/graasp/issues/421)) ([6258099](https://github.com/graasp/graasp/commit/6258099382065c14e78de153ffc93effb0549ae1))
* export a zip use stream ([#568](https://github.com/graasp/graasp/issues/568)) ([cc71cea](https://github.com/graasp/graasp/commit/cc71cea4ffa5796f5e03694797657e1fdfe23ac4))
* use mailer in itemMembership service, fix notification ([#565](https://github.com/graasp/graasp/issues/565)) ([3df4f90](https://github.com/graasp/graasp/commit/3df4f903e477f0663f8b73d22ae28fd15d3347e0))


### Tests

* fix Patch app data file test ([#566](https://github.com/graasp/graasp/issues/566)) ([1653ab2](https://github.com/graasp/graasp/commit/1653ab2393ed78c2318267d4c71e1506bdf2f8d3))

## [1.5.0](https://github.com/graasp/graasp/compare/v1.4.0...v1.5.0) (2023-08-22)


### chore

* release 1.5.0 ([7db0341](https://github.com/graasp/graasp/commit/7db0341fbfd3832681b33ec1165200614d009d5a))

## [1.4.0](https://github.com/graasp/graasp/compare/v1.3.1...v1.4.0) (2023-08-15)


### Features

* always redirect mobile auth to universal auth link ([#539](https://github.com/graasp/graasp/issues/539)) ([0433e84](https://github.com/graasp/graasp/commit/0433e84c4ed45fb1213245d846389d22ad15ce3c))


### Bug Fixes

* allow bearer token by using attemptVerifyAuthentication instead of fetchMemberInSession ([#551](https://github.com/graasp/graasp/issues/551)) ([6fd25fa](https://github.com/graasp/graasp/commit/6fd25fafb280ab9563ee079693ca51fdc5f944b0))
* optimize db queries ([#534](https://github.com/graasp/graasp/issues/534)) ([6b881f5](https://github.com/graasp/graasp/commit/6b881f528c027b4108511634167a99a67304e96e))
* remove sentry profiling and bump versions to resolve types ([#559](https://github.com/graasp/graasp/issues/559)) ([5d186d8](https://github.com/graasp/graasp/commit/5d186d84e9b9f04c74d3bf70b9f50245fa56c162))

## [1.3.1](https://github.com/graasp/graasp/compare/v1.3.0...v1.3.1) (2023-08-11)


### Bug Fixes

* fix token sub key ([#545](https://github.com/graasp/graasp/issues/545)) ([ec03f63](https://github.com/graasp/graasp/commit/ec03f6302766135b8ac483dc2c8fc352a0424ca2))

## [1.3.0](https://github.com/graasp/graasp/compare/v1.2.7...v1.3.0) (2023-08-11)


### Features

* add aggregate action endpoint ([#514](https://github.com/graasp/graasp/issues/514)) ([22c2ef8](https://github.com/graasp/graasp/commit/22c2ef815dd57e525efa2ff92ad06e93be80eda9))
* release a version for [#471](https://github.com/graasp/graasp/issues/471) ([#532](https://github.com/graasp/graasp/issues/532)) ([582fe21](https://github.com/graasp/graasp/commit/582fe21fe97423ae0a0014dfab190235f072d18a))
* replace mobile redirect with domain-based deep link ([#499](https://github.com/graasp/graasp/issues/499)) ([3dfdd69](https://github.com/graasp/graasp/commit/3dfdd69228812b53f309442fe4e21a3d494a785c))


### Bug Fixes

* fix published queries to prevent cross table queries ([#531](https://github.com/graasp/graasp/issues/531)) ([80ae941](https://github.com/graasp/graasp/commit/80ae941f1a0bddf3cfb2b609e47be45955ba6eb6))
* null creator in ws hooks ([#527](https://github.com/graasp/graasp/issues/527)) ([47c01ce](https://github.com/graasp/graasp/commit/47c01ce228a70ef4a547f48a35278c7595035d89))
* return inherit item login schema, prevent put from child ([#513](https://github.com/graasp/graasp/issues/513)) ([5b01536](https://github.com/graasp/graasp/commit/5b0153614356490382bfa4bd5a6215becc26ccba))
* throw for undefined member id in token ([#544](https://github.com/graasp/graasp/issues/544)) ([5f0c059](https://github.com/graasp/graasp/commit/5f0c059e56eeebc9e58f3368d29a582eddf4f501))

## [1.2.7](https://github.com/graasp/graasp/compare/v1.2.6...v1.2.7) (2023-07-31)


### Bug Fixes

* remove check user storage on upload ([#528](https://github.com/graasp/graasp/issues/528)) ([94af996](https://github.com/graasp/graasp/commit/94af9968d5f1697f73e75d4c7176643605b0cbf8))

## [1.2.6](https://github.com/graasp/graasp/compare/v1.2.5...v1.2.6) (2023-07-31)


### Bug Fixes

* File upload oom ([#520](https://github.com/graasp/graasp/issues/520)) ([fe3da6e](https://github.com/graasp/graasp/commit/fe3da6e8d341a737536ca05b778723c843ff6157))

## [1.2.5](https://github.com/graasp/graasp/compare/v1.2.4...v1.2.5) (2023-07-31)


### Bug Fixes

* add creator in getPublishedItemsByCategories ([#524](https://github.com/graasp/graasp/issues/524)) ([bf48e64](https://github.com/graasp/graasp/commit/bf48e6427c239df0ed4b32ef17ebe03df500ce71))
* copied item should not inherit public tag from original ([#522](https://github.com/graasp/graasp/issues/522)) ([fabc79d](https://github.com/graasp/graasp/commit/fabc79d51937d85ce8f8396aa7ec1c60af38799d))
* improve import zip, fix undefined parent ([#496](https://github.com/graasp/graasp/issues/496)) ([4842925](https://github.com/graasp/graasp/commit/4842925fbeed0a3b99c46ce239b943aae1d8f422))

## [1.2.4](https://github.com/graasp/graasp/compare/v1.2.3...v1.2.4) (2023-07-26)

### Bug Fixes

- add `creator` in recent, liked and publishedByMember collections ([#502](https://github.com/graasp/graasp/issues/502)) ([a4377b9](https://github.com/graasp/graasp/commit/a4377b973c49228ca95f75d888ebbccec1945860))
- allow multiple extra and settings fields on update ([#507](https://github.com/graasp/graasp/issues/507)) ([cde5967](https://github.com/graasp/graasp/commit/cde5967e82c51606efd3a01ee864e7343ade7e60))
- fix get app data for reader, throw on patch others' app data ([#504](https://github.com/graasp/graasp/issues/504)) ([e727903](https://github.com/graasp/graasp/commit/e7279037ae20592837d9bd0b8027753f4804a8d6))

## [1.2.3](https://github.com/graasp/graasp/compare/v1.2.2...v1.2.3) (2023-07-21)

### Bug Fixes

- do not specify default for item settings in entity ([#494](https://github.com/graasp/graasp/issues/494)) ([972f86b](https://github.com/graasp/graasp/commit/972f86bd482756f3f0e8d25ae4f417429220f4de))
- fix detachedMoveHousekeeping to move to root ([#484](https://github.com/graasp/graasp/issues/484)) ([7883f2d](https://github.com/graasp/graasp/commit/7883f2d4760874188351b45bcb5bc564068b45d9))

## [1.2.2](https://github.com/graasp/graasp/compare/v1.2.1...v1.2.2) (2023-07-20)

### Bug Fixes

- add migration to clean tags ([#488](https://github.com/graasp/graasp/issues/488)) ([788a237](https://github.com/graasp/graasp/commit/788a237dbd83283b85ce6d3119b2678c01007f30))
- bump sentry and document usage of decorateRequest ([#360](https://github.com/graasp/graasp/issues/360)) ([c4b14b2](https://github.com/graasp/graasp/commit/c4b14b2cd12763ba7e30a646399a0230b3fb8a93))
- **deps:** update dependency @casl/ability to v6.3.4 ([#410](https://github.com/graasp/graasp/issues/410)) ([8547564](https://github.com/graasp/graasp/commit/854756422d2d41cdc7226182aca10857f46cc7a8))
- **deps:** update dependency @graasp/sdk to v1.1.3 ([#490](https://github.com/graasp/graasp/issues/490)) ([2152d97](https://github.com/graasp/graasp/commit/2152d97f1b2a3d79c467552170180b5ada9931b4))
- **deps:** update dependency @sentry/profiling-node to v1.0.8 ([#480](https://github.com/graasp/graasp/issues/480)) ([c9e079f](https://github.com/graasp/graasp/commit/c9e079fba05acf389a7a87ca554afa301e6c117e))
- **deps:** update dependency french-badwords-list to v1.0.7 ([c6321ee](https://github.com/graasp/graasp/commit/c6321ee34dafaed0d230e71579e01cfd64096088))
- item relation can be null because of soft-delete ([#483](https://github.com/graasp/graasp/issues/483)) ([ce4a7e3](https://github.com/graasp/graasp/commit/ce4a7e384e0a087949e4b04af880ecb10add7ce7))
- m/login-password to send the resource in the body ([#486](https://github.com/graasp/graasp/issues/486)) ([448d30e](https://github.com/graasp/graasp/commit/448d30e0094ca87aedbfe01819833f0fd08a39cd))
- remove duplicate public tag in migration ([#492](https://github.com/graasp/graasp/issues/492)) ([1a24b62](https://github.com/graasp/graasp/commit/1a24b6250da50fc26f280733875b019deedaf74d))
- return root published item when querying for a child item ([#466](https://github.com/graasp/graasp/issues/466)) ([d5351e9](https://github.com/graasp/graasp/commit/d5351e9cf4548425c33b33f760bf117b28881d1a))

## [1.2.1](https://github.com/graasp/graasp/compare/v1.2.0...v1.2.1) (2023-07-04)

### Bug Fixes

- **deps:** update dependency @fastify/helmet to v10.1.1 ([7ecc3a0](https://github.com/graasp/graasp/commit/7ecc3a0e64c588036f2dd13ba4c57429920c37cc))
- **deps:** update dependency @graasp/sdk to v1.1.1 ([#468](https://github.com/graasp/graasp/issues/468)) ([345e2f5](https://github.com/graasp/graasp/commit/345e2f5c16197825cb9c7e3565aacdd305e8b73e))
- **deps:** update dependency qs to v6.11.2 ([a9003c1](https://github.com/graasp/graasp/commit/a9003c1c0b64716fbf42ca63ed694c9bcd6be069))
- make membership websockets hooks work again ([#408](https://github.com/graasp/graasp/issues/408)) ([9172daf](https://github.com/graasp/graasp/commit/9172dafb302ee8c9ab8c05de4e6b1d701b62dd68))

## [1.2.0](https://github.com/graasp/graasp/compare/v1.1.0...v1.2.0) (2023-06-29)

### Features

- add etherpad features in core ([#467](https://github.com/graasp/graasp/issues/467)) ([7e0ca67](https://github.com/graasp/graasp/commit/7e0ca67bfc09275fed2bc35bc48595f7e024eb67))
- add get most liked collections endpoint ([#397](https://github.com/graasp/graasp/issues/397)) ([ced62da](https://github.com/graasp/graasp/commit/ced62da1270130d2edd7e7f2d5b06d50d9fdf2c9))
- allow to edit file item extra's alttext ([#423](https://github.com/graasp/graasp/issues/423)) ([4f0c73c](https://github.com/graasp/graasp/commit/4f0c73cd476c3a40d526cc5b38895792bd5693fb))
- export chat messages ([#459](https://github.com/graasp/graasp/issues/459)) ([1010399](https://github.com/graasp/graasp/commit/1010399b32b2e0f7e3bf21c6c81f8aba57d22bec))

### Bug Fixes

- bundle chat action in db transaction ([#386](https://github.com/graasp/graasp/issues/386)) ([405109e](https://github.com/graasp/graasp/commit/405109e2c01a5de21070518a8e90384498233a17))
- **dev:** localstack and s3 bucket ([280dfc5](https://github.com/graasp/graasp/commit/280dfc553d68703dfa8a8bec1c051b6a9ac6ca3e))
- getItemsByCategories only return root items ([#427](https://github.com/graasp/graasp/issues/427)) ([36223a3](https://github.com/graasp/graasp/commit/36223a3508df54ce6ff5a75c689449ed02b547da))
- prevent deletion of only / last admin on item ([#403](https://github.com/graasp/graasp/issues/403)) ([eacd3d0](https://github.com/graasp/graasp/commit/eacd3d05776b858f223ae0bb0c54298404c6825e))
- return creator for published items ([#457](https://github.com/graasp/graasp/issues/457)) ([280dfc5](https://github.com/graasp/graasp/commit/280dfc553d68703dfa8a8bec1c051b6a9ac6ca3e))

## [1.1.0](https://github.com/graasp/graasp/compare/v1.0.1...v1.1.0) (2023-06-21)

### Features

- refactor favorite items ([#379](https://github.com/graasp/graasp/issues/379)) ([6e4111f](https://github.com/graasp/graasp/commit/6e4111f3870b7c470a1b87b6e1e2f9471e94c461))

### Bug Fixes

- fix migrations for recycled items ([#405](https://github.com/graasp/graasp/issues/405)) ([e48c88d](https://github.com/graasp/graasp/commit/e48c88dfe6d411853db07a2f65d91b29cee6947f))

## [1.0.1](https://github.com/graasp/graasp/compare/v1.0.0...v1.0.1) (2023-06-20)

### Bug Fixes

- fix deploy workflows ([#401](https://github.com/graasp/graasp/issues/401)) ([8f3a404](https://github.com/graasp/graasp/commit/8f3a404860270f7c17f55a2d254c183e1acb016f))

## [1.0.0](https://github.com/graasp/graasp/compare/v0.9.0...v1.0.0) (2023-06-20)

### Features

- add get recent collections endpoint ([#393](https://github.com/graasp/graasp/issues/393)) ([5c91bf2](https://github.com/graasp/graasp/commit/5c91bf299224c801e508a5e3af3db7a9ccd075f0))

### Bug Fixes

- create membership for copied item ([#391](https://github.com/graasp/graasp/issues/391)) ([0e8af6c](https://github.com/graasp/graasp/commit/0e8af6c7281493c924f8bfa58d328a23907fe25d))
- h5p secret key env var typo ([#387](https://github.com/graasp/graasp/issues/387)) ([5e59ae4](https://github.com/graasp/graasp/commit/5e59ae491aac520d4e1510c7dbf3bba43106b8c4))
- update deployment workflows ([#400](https://github.com/graasp/graasp/issues/400)) ([4bfac3b](https://github.com/graasp/graasp/commit/4bfac3bb779332baced9d6aaa1043b75e9ebce25))

### chore

- release 1.0.0 ([cf11c2c](https://github.com/graasp/graasp/commit/cf11c2c7faedb2c973fcff45c12d5ced845e54a9))

## [0.9.0](https://github.com/graasp/graasp/compare/v0.8.1...v0.9.0) (2023-04-20)

### Features

- add etherpad zip import / export ([#374](https://github.com/graasp/graasp/issues/374)) ([ab20c82](https://github.com/graasp/graasp/commit/ab20c82c334c7286bea82fb3c8b123b0008488c1))

### Bug Fixes

- allow empty string for replica env var to disable ([#375](https://github.com/graasp/graasp/issues/375)) ([40f1815](https://github.com/graasp/graasp/commit/40f18158a7461c69da5c72b3783fb189eacd2c61))

## [0.8.1](https://github.com/graasp/graasp/compare/v0.8.0...v0.8.1) (2023-03-28)

### Bug Fixes

- remove duplicate recaptcha secret in workflows ([eaad2da](https://github.com/graasp/graasp/commit/eaad2dade08ad51d66a89f4e289e66fd0975e1e2))

## [0.8.0](https://github.com/graasp/graasp/compare/v0.7.0...v0.8.0) (2023-03-28)

### Features

- add recaptcha ([#365](https://github.com/graasp/graasp/issues/365)) ([#370](https://github.com/graasp/graasp/issues/370)) ([6fe5ecc](https://github.com/graasp/graasp/commit/6fe5eccb83c24fc4d76ff4cfd1f5b3cdcbe69b91))

### Bug Fixes

- add recaptcha in workflows ([#366](https://github.com/graasp/graasp/issues/366)) ([8c3d563](https://github.com/graasp/graasp/commit/8c3d56384bd3afd96bbd28dc0f8663b752a22a84))
- bump @graasp/plugin-etherpad ([#369](https://github.com/graasp/graasp/issues/369)) ([ff05d43](https://github.com/graasp/graasp/commit/ff05d435fa869c9726bcca8e77a9d984e6db018e))

## [0.7.0](https://github.com/graasp/graasp/compare/v0.6.0...v0.7.0) (2023-03-22)

### Features

- bump dependencies ([#359](https://github.com/graasp/graasp/issues/359)) ([066268a](https://github.com/graasp/graasp/commit/066268a3bfd13763ebb5c132d9ed3439ad37b721))

### Bug Fixes

- bump @graasp/etherpad ([#358](https://github.com/graasp/graasp/issues/358)) ([e5df2d6](https://github.com/graasp/graasp/commit/e5df2d692cb66c0f1b89873546f96eeb79b4cbd4))

## [0.6.0](https://github.com/graasp/graasp/compare/v0.5.3...v0.6.0) (2023-03-17)

### Features

- bump fastify to 3.29.5 ([#349](https://github.com/graasp/graasp/issues/349)) ([e0c393a](https://github.com/graasp/graasp/commit/e0c393ac442c3fa3389d244e4b634625b32d663f))
- upgrade websockets with @graasp/plugin-websockets bump ([#355](https://github.com/graasp/graasp/issues/355)) ([0bce308](https://github.com/graasp/graasp/commit/0bce30844124d610d37358fa7d1e47c260cd5ff0))

### Bug Fixes

- update types from SDK ([#352](https://github.com/graasp/graasp/issues/352)) ([d68777c](https://github.com/graasp/graasp/commit/d68777c1e2ce84c9a7ae6ec5d5f64f5c2e9e2fc7))

## [0.5.3](https://github.com/graasp/graasp/compare/v0.5.2...v0.5.3) (2023-03-13)

### Bug Fixes

- update zip package ([#344](https://github.com/graasp/graasp/issues/344)) ([d633278](https://github.com/graasp/graasp/commit/d6332787386a2b96ae9d9ea07ecda3c82139455e))

## [0.5.2](https://github.com/graasp/graasp/compare/v0.5.1...v0.5.2) (2023-03-01)

### Bug Fixes

- **sentry:** disable profiling, bump versions, ignore auto breadcrumbs ([#340](https://github.com/graasp/graasp/issues/340)) ([e7b3287](https://github.com/graasp/graasp/commit/e7b3287c70b61634568ebb913d9d0b9df411702b))

## [0.5.1](https://github.com/graasp/graasp/compare/v0.5.0...v0.5.1) (2023-02-24)

### Bug Fixes

- update invitation permission ([#334](https://github.com/graasp/graasp/issues/334)) ([abe1f74](https://github.com/graasp/graasp/commit/abe1f7498b5cc062ad8880dad8d9050ad81296bc))

## [0.5.0](https://github.com/graasp/graasp/compare/v0.4.1...v0.5.0) (2023-02-23)

### Features

- update graasp-plugin-websockets ([#329](https://github.com/graasp/graasp/issues/329)) ([e01c407](https://github.com/graasp/graasp/commit/e01c4072fdf80fb82eadd78114b8416367c8d1f1))

### Bug Fixes

- bump [@sentry](https://github.com/sentry) dependencies ([#336](https://github.com/graasp/graasp/issues/336)) ([dd6b40b](https://github.com/graasp/graasp/commit/dd6b40b1a197c2d2b4ab07290d44b1f9781a7aa7))

## [0.4.1](https://github.com/graasp/graasp/compare/v0.4.0...v0.4.1) (2023-02-07)

### Bug Fixes

- **metrics:** use router path for sentry ([#327](https://github.com/graasp/graasp/issues/327)) ([de5c681](https://github.com/graasp/graasp/commit/de5c681f9b3c110fba325777b332fb1362a892d3))

## [0.4.0](https://github.com/graasp/graasp/compare/v0.3.2...v0.4.0) (2023-02-06)

### Features

- **sentry:** improve sentry metrics ([#325](https://github.com/graasp/graasp/issues/325)) ([06ce786](https://github.com/graasp/graasp/commit/06ce78628f2b0437646e4118ab91c6f5bb5ca659))

### Bug Fixes

- update validation plugin ([#324](https://github.com/graasp/graasp/issues/324)) ([0996cfa](https://github.com/graasp/graasp/commit/0996cfaca6792e8fccde6a809fd5584e84555dea))

## [0.3.2](https://github.com/graasp/graasp/compare/v0.3.1...v0.3.2) (2023-02-02)

### Bug Fixes

- release new version with fixes ([8aa2e4d](https://github.com/graasp/graasp/commit/8aa2e4d774007916a4cd8b4ea7ddbbdaccd39cbf))

## [0.3.1](https://github.com/graasp/graasp/compare/v0.3.0...v0.3.1) (2023-01-31)

### Bug Fixes

- downgrade @sentry/profiling-node to 0.0.12 ([#319](https://github.com/graasp/graasp/issues/319)) ([03e38a5](https://github.com/graasp/graasp/commit/03e38a5ffd0a13bf48d315b27dcbe70500ad4f05))

## [0.3.0](https://github.com/graasp/graasp/compare/v0.2.1...v0.3.0) (2023-01-30)

### Features

- add sentry metrics ([#315](https://github.com/graasp/graasp/issues/315)) ([d43d7ae](https://github.com/graasp/graasp/commit/d43d7aecfea12d77a89e05df4a4752249f595710))

### Bug Fixes

- fix security alerts from dependencies ([#310](https://github.com/graasp/graasp/issues/310)) ([f5ad55f](https://github.com/graasp/graasp/commit/f5ad55f12e37a221537386633e24ca0f30f3ce1a))
- return shared sibling items ([#305](https://github.com/graasp/graasp/issues/305)) ([fe05726](https://github.com/graasp/graasp/commit/fe057268486d8d57f931f93d8d13e39a91ac8edb))

## [0.2.1](https://github.com/graasp/graasp/compare/v0.2.0...v0.2.1) (2023-01-19)

### Bug Fixes

- isolate transactions ([#302](https://github.com/graasp/graasp/issues/302)) ([b44b486](https://github.com/graasp/graasp/commit/b44b486e5e12ea6a0ebd38bc3b64bcc94f38f43a))

## [0.2.0](https://github.com/graasp/graasp/compare/v0.1.8...v0.2.0) (2023-01-11)

### Features

- add etherpad service ([#295](https://github.com/graasp/graasp/issues/295)) ([f8b3b0d](https://github.com/graasp/graasp/commit/f8b3b0ded745bec39d41ad9626708a5f5631ea78))
- implement DB read replicas ([#288](https://github.com/graasp/graasp/issues/288)) ([3e6793f](https://github.com/graasp/graasp/commit/3e6793f7d07d23a09105fb450b5b49e819df2484))

### Bug Fixes

- correctly assign interceptors when undefined ([#290](https://github.com/graasp/graasp/issues/290)) ([1bfb8b3](https://github.com/graasp/graasp/commit/1bfb8b3e2c6f097fa452436be2210252e5bc0814))
- pin graasp-plugin-thumbnails and graasp-plugin-file-item before transactions fix ([#299](https://github.com/graasp/graasp/issues/299)) ([67f7597](https://github.com/graasp/graasp/commit/67f75977a3628eda0f54bd4fda4ce9f97aae4f7b))

### 0.1.8 (2022-11-28)

### 0.1.7 (2022-11-07)

### Bug Fixes

- upgrade h5p plugin with upload task runner bypass ([#275](https://github.com/graasp/graasp/issues/275)) ([ef985c0](https://github.com/graasp/graasp/commit/ef985c095d2d18921b27123664e78cb5e7ca1ff5))

### 0.1.6 (2022-10-27)

### 0.1.5 (2022-10-27)

### 0.1.4 (2022-10-11)

### 0.1.3 (2022-09-09)

### Bug Fixes

- add path in delete item subtask ([28c7772](https://github.com/graasp/graasp/commit/28c777279aba08406dc9fffdb29ce00ff69059bc))

### 0.1.2 (2022-09-07)

### [0.1.1](https://github.com/graasp/graasp/compare/v0.1.0...v0.1.1) (2022-08-12)

### Bug Fixes

- allow posthook in descendants in copy task ([#242](https://github.com/graasp/graasp/issues/242)) ([578231f](https://github.com/graasp/graasp/commit/578231f6a6fe5b47bb993a10f0aadc8cbb42f547))
- update workflow sha ref ([927adea](https://github.com/graasp/graasp/commit/927adea75ebc6a6064e9c29b76dfa1e113d52e95))
- update workflow sha ref ([d382ddd](https://github.com/graasp/graasp/commit/d382ddd83505ec92c3b4e9cee8a8a4f7df2c4182))
- update workflow sha ref ([42bc90d](https://github.com/graasp/graasp/commit/42bc90d2cd3d49a5aff5a4adbe6d143287fb976c))

## 0.1.0 (2022-07-21)

### Features

- "get many" items endpoint ([7254115](https://github.com/graasp/graasp/commit/7254115b930d7f95d3bcaab2c664a92d16306317)), closes [#22](https://github.com/graasp/graasp/issues/22)
- /members/current api ([7c0ae12](https://github.com/graasp/graasp/commit/7c0ae121170652b427014ea6afcb84a9f164f101))
- add correct return codes if login / register fails ([7f2ff94](https://github.com/graasp/graasp/commit/7f2ff947660488f9e010fb3282869c471e9fa9e8))
- add get descendants task ([f7b8b44](https://github.com/graasp/graasp/commit/f7b8b446c45a9a993e60265c61d889cef69a6ad0))
- add get many members, update action plugin ([#184](https://github.com/graasp/graasp/issues/184)) ([39ae443](https://github.com/graasp/graasp/commit/39ae443f29376237485e91332ffc74e64dab713c))
- add graasp-item-login plugin ([e893a0c](https://github.com/graasp/graasp/commit/e893a0c0a7028093eae0e20be3ca2aad94e3fe19))
- add graasp-item-tags plugin to graasp ([e34c99a](https://github.com/graasp/graasp/commit/e34c99a70c98bfb6356007171b1be8560f7d54f4)), closes [#24](https://github.com/graasp/graasp/issues/24)
- add graasp-websockets dependency, register plugin ([c942a57](https://github.com/graasp/graasp/commit/c942a578e01aff02fd439b68612a27743a97397a))
- add hidden item plugin ([15679d0](https://github.com/graasp/graasp/commit/15679d0663fd8fe085b2e0dda6c7c06ccd7f012c))
- add import zip endpoint ([bc50fab](https://github.com/graasp/graasp/commit/bc50fab0e4cc1e1fb3ba2a264708edc1215583b7))
- add item action logic and tests ([#170](https://github.com/graasp/graasp/issues/170)) ([5dcfe53](https://github.com/graasp/graasp/commit/5dcfe53a9d68c2314c3a722f0f66453ddb711d26))
- add lang options in login and register calls ([a762be3](https://github.com/graasp/graasp/commit/a762be30d43daa466b99e4c4f4dadc95df3a52d2))
- add localstack to test/dev s3 locally ([ce0a01f](https://github.com/graasp/graasp/commit/ce0a01f694342b6d75042c89898780af4f430e81))
- add new env variables for cintegration ([3998455](https://github.com/graasp/graasp/commit/39984554c2a0d86979a7d0c678bcbd58566c4ecb))
- add new env variables for the backend ([09ff218](https://github.com/graasp/graasp/commit/09ff2184008125abbcf3f178e3803a911c5cd9b8))
- add password login endpoint ([1eeac04](https://github.com/graasp/graasp/commit/1eeac0486656d0040a43fc3a920ca92d80ba5d53))
- add password login endpoint for mobile app ([59b9b9d](https://github.com/graasp/graasp/commit/59b9b9d1f06f1354017072faf8d58bec2c8bec9e))
- add prettier scripts in package.json ([49525c1](https://github.com/graasp/graasp/commit/49525c19fdd0683117efa1de930a2a09303568f3))
- add publisher id in config ([#217](https://github.com/graasp/graasp/issues/217)) ([491d14c](https://github.com/graasp/graasp/commit/491d14c9c9493d82e1646c67b61a9ca892277cb9))
- add recycle bin plugin ([b7b9482](https://github.com/graasp/graasp/commit/b7b94825f862ab781cce62142b301e81b37e7e76))
- add return codes to mobile endpoints ([3f2623d](https://github.com/graasp/graasp/commit/3f2623db0ca2795587a327d37379b33df40a3f80))
- add route to get multiple users at once ([439da07](https://github.com/graasp/graasp/commit/439da076b867f8a49ba60bfc5f4c2c69c1a31a45))
- add settings column and schemas ([1b8c6d4](https://github.com/graasp/graasp/commit/1b8c6d4b765793218de0e82dbdf6adfb14266058))
- add subscription plugin toggle ([138fe66](https://github.com/graasp/graasp/commit/138fe6658ec83eca7478564cc270a018c1f0596b))
- add subscriptions plugin ([4cbfd72](https://github.com/graasp/graasp/commit/4cbfd72286f4baa1df9500670fe44eed393de7d3))
- add tags in schema ([d1a1024](https://github.com/graasp/graasp/commit/d1a1024e81d392ce40403cc4e01e24d28765eb4f))
- add task definition schema ([f0d6d81](https://github.com/graasp/graasp/commit/f0d6d81b55c47d21a58cdd84da4903674c7f35af))
- add thumbnail plugin ([f1c8f32](https://github.com/graasp/graasp/commit/f1c8f32ef7334f6657a67c52fca8bd7f20319001))
- allow item plugins to extend create schema ([1fc02d9](https://github.com/graasp/graasp/commit/1fc02d9c6d4481548a8d19de62c25f3df261288b))
- allow item's children to be fetched w custom order ([a7c9d70](https://github.com/graasp/graasp/commit/a7c9d70cf58487526fdbd53c054d6862f0f4eaef)), closes [#53](https://github.com/graasp/graasp/issues/53)
- allow partial execution of subtasks ([fef8de8](https://github.com/graasp/graasp/commit/fef8de86a4c322569c38702d3c7f626cf8873b1c)), closes [#19](https://github.com/graasp/graasp/issues/19)
- api endpoint to fetch "own" items ([d4fcb18](https://github.com/graasp/graasp/commit/d4fcb18635f17930edb889caeeea67ba4dceb85d)), closes [#12](https://github.com/graasp/graasp/issues/12)
- api endpoint to fetch an item's children ([39d8f77](https://github.com/graasp/graasp/commit/39d8f7709828d3a5aba74abf3bc8c04d2490bf7b)), closes [#6](https://github.com/graasp/graasp/issues/6)
- api endpoint to fetch an item's memberships ([a96a1e4](https://github.com/graasp/graasp/commit/a96a1e400f971253f6b327ac086a4998cb29c78a)), closes [#8](https://github.com/graasp/graasp/issues/8)
- api endpoint to fetch items "shared with" member ([c9ba354](https://github.com/graasp/graasp/commit/c9ba354217ae5a41911688a8858ea93910dfd672)), closes [#13](https://github.com/graasp/graasp/issues/13)
- api to remove all memberships in item tree ([cf70db3](https://github.com/graasp/graasp/commit/cf70db3d2143d5520f25dc889a5a78e87202ebc3)), closes [#55](https://github.com/graasp/graasp/issues/55)
- automate CI caller workflow ([0b25f6b](https://github.com/graasp/graasp/commit/0b25f6b831aa594f2ee856730238d4d00946db89))
- cdelivery caller workflow to new approach ([b74530a](https://github.com/graasp/graasp/commit/b74530a88c674278ac919c69594df6b78bef57c3))
- CORS settings per /path ([1b654af](https://github.com/graasp/graasp/commit/1b654af4fff52261e369c4d7cc2e7a7ac3e52b3b)), closes [#52](https://github.com/graasp/graasp/issues/52)
- create and get-by member(s) tasks ([9ee8350](https://github.com/graasp/graasp/commit/9ee83507993818a4effc44cb768b1e9ac16ee391))
- custom pre/post handlers to execute with tasks ([46ababd](https://github.com/graasp/graasp/commit/46ababdf1f9393e5a0c92c7d58a8f50b5b6736a3))
- embedded link item (using iframely) ([cc256cf](https://github.com/graasp/graasp/commit/cc256cf4df2037f976c75ef3f58fe2a80402509e))
- enable hooks for items thumbnails ([d2b6bde](https://github.com/graasp/graasp/commit/d2b6bde8d7185bd19523f3696f6d4cdcce3b75e4))
- enable member to delete own account ([1c99f7e](https://github.com/graasp/graasp/commit/1c99f7eb46b8c00ee32d39c3409a4bcbfabeeebd))
- enable new file plugin ([ba4de2a](https://github.com/graasp/graasp/commit/ba4de2a7c33f6ff00dc67824fe05faeef74fa165))
- extendable update schemas ([bf76531](https://github.com/graasp/graasp/commit/bf76531f9d9f10e779290f2c96e89656619a53a3))
- folder item (core); document item ([59fb206](https://github.com/graasp/graasp/commit/59fb2066668644d3c8b38c9de982baafd410eed3))
- get members by property (email) ([ad24e42](https://github.com/graasp/graasp/commit/ad24e42f769218dd2f3852ddc91e35b9e2143231)), closes [#23](https://github.com/graasp/graasp/issues/23)
- graasp-apps plugin ([50bc627](https://github.com/graasp/graasp/commit/50bc6278601b1e5953f30ac982d5f613046c749d))
- graasp-plugin-actions integration ([5da901f](https://github.com/graasp/graasp/commit/5da901fdbb644ce43b061505d4f2eb507e18b1b8))
- include required scripts to use standard-version ([5cae435](https://github.com/graasp/graasp/commit/5cae43539c8047a8e40db31a6afa3970bc3ab3df))
- include standard-version dependency ([8beaab9](https://github.com/graasp/graasp/commit/8beaab9a0fb4f574060073a196ade26e8ae72440))
- inject redis config as plugin option, optional enable, update graasp-websockets ([5439c20](https://github.com/graasp/graasp/commit/5439c2004d69d402d396211ad42ea1df662107e4))
- install prettier with basic config ([b433861](https://github.com/graasp/graasp/commit/b433861d4ee949b87552ab9b4953d29cb9a01d2d))
- item type ([b7a78ff](https://github.com/graasp/graasp/commit/b7a78ff025f00ba7e54febfc38c2d6383695d3df))
- **memberships:** allow the removal of all below ([05d5d66](https://github.com/graasp/graasp/commit/05d5d66f3f3ffd8af6f2b38d13ca0f834c209e49))
- not return password value ([2ec2b35](https://github.com/graasp/graasp/commit/2ec2b3582c080fae0438136f3b23aecdfe993d16))
- not return password value ([2ba363e](https://github.com/graasp/graasp/commit/2ba363ec4f835b5919fd94cf8b58d9eb5da6b998))
- public items plugin ([e8c47ef](https://github.com/graasp/graasp/commit/e8c47ef9ce8fa39475675da7b0ca530cf7e2712c)), closes [#42](https://github.com/graasp/graasp/issues/42)
- register chat plugin at items route ([84e5d48](https://github.com/graasp/graasp/commit/84e5d487c6a7086f2b5f6027d90e30dfb169dae7))
- register item flagging plugin ([bf34b4b](https://github.com/graasp/graasp/commit/bf34b4b306a464d91e255e3a0e69eff6faa39acf))
- register plugin ([18b410a](https://github.com/graasp/graasp/commit/18b410ae60778ed06fe656224ddc1d0741b5a767))
- register plugins ([55abf77](https://github.com/graasp/graasp/commit/55abf77d83c8b00a99553ab3989015b452a20950))
- register publish plugin ([#214](https://github.com/graasp/graasp/issues/214)) ([2ddfa55](https://github.com/graasp/graasp/commit/2ddfa55ed85b98ac38dad7b19d158ee58c3b3432))
- register search plugin ([dc7980a](https://github.com/graasp/graasp/commit/dc7980aa7f73ab7aa54f5ffeb8ed491a4a211b0e))
- register search plugin ([f89bf45](https://github.com/graasp/graasp/commit/f89bf45c36b707c3782a808281762b465cd5ae6e))
- register websocket events for items ([12a1133](https://github.com/graasp/graasp/commit/12a1133a670481bede9892b8566ef9ad085ee7fd))
- register websockets events for item memberships ([8702137](https://github.com/graasp/graasp/commit/8702137f40cb80397808b474201959384edfa059))
- register websockets events for member updates (own, shared) ([0755ca4](https://github.com/graasp/graasp/commit/0755ca469bdbfae38d9013080a6c5e4e2eec4642))
- s3 file item can be enabled by setting the proper configs ([b639e4a](https://github.com/graasp/graasp/commit/b639e4afa8993cb09e05002f09e911c6a0c6458e))
- set/unset post delete item handlers ([deab2de](https://github.com/graasp/graasp/commit/deab2de2ed09e7faa3387da02e83dbedbc8272e2)), closes [#2](https://github.com/graasp/graasp/issues/2)
- set/unset pre copy item handlers ([38d9230](https://github.com/graasp/graasp/commit/38d9230fa765bcd9e112c12c85b6e2f19e9daa02))
- signup and signin ([91cb3b0](https://github.com/graasp/graasp/commit/91cb3b022941df0f563f336c93fd788b642c243e)), closes [#15](https://github.com/graasp/graasp/issues/15)
- sing in/up emails ([b45b996](https://github.com/graasp/graasp/commit/b45b996382751d9f12c5ba785bccb6fc0029a523)), closes [#18](https://github.com/graasp/graasp/issues/18)
- status endpoint that returns 'OK' (200) ([cde4178](https://github.com/graasp/graasp/commit/cde4178b574e61521d4357baa92d8691e81185f5))
- throw custom error code for expired token ([2cba63a](https://github.com/graasp/graasp/commit/2cba63a67c7f870ace87f4536c62fa2054d04d7a))
- token based auth ([a19bda5](https://github.com/graasp/graasp/commit/a19bda52ee4f4ef28b6a2d6e3d459aa4ca93fdb5)), closes [#38](https://github.com/graasp/graasp/issues/38)
- token based auth for core api ([6ca6194](https://github.com/graasp/graasp/commit/6ca6194a3a904d1c6c8f66009ff39a8a45a93cc5))
- update devcontainers & CI to use node 16 ([d075cb9](https://github.com/graasp/graasp/commit/d075cb9763234bce35c87292cf09d8a5b8d4dd6f))
- update for public categories endpoints ([cb21a00](https://github.com/graasp/graasp/commit/cb21a00f940fcfd7c695f38f5cc5b3c33d2903bb))
- update member api/task ([3f77c8e](https://github.com/graasp/graasp/commit/3f77c8e14205955ff6244dacdecd78d5ee9360c7))
- update member password ([0f0fb2a](https://github.com/graasp/graasp/commit/0f0fb2adba6e5f54bfad45c753f314f55ae4fb61))
- update staging versions in graasp deploy ([86016f7](https://github.com/graasp/graasp/commit/86016f7293a4a7286a1227a6a6eca4a0f4ecbde8))
- use custom validation for users and items ([d553698](https://github.com/graasp/graasp/commit/d5536984dbdc6666e0991397c25bb04fea648f35))
- use http status codes and reasonphrases ([999f068](https://github.com/graasp/graasp/commit/999f068e7ea8d0e53e8a82205529a9dc08d65f6e))
- verify credentials with stored hash ([398b775](https://github.com/graasp/graasp/commit/398b775bfa2ed9dcee8dbd728909740137d7b808))

### Bug Fixes

- "'async' modifier cannot be used with 'abstract' modifier" ([63199b1](https://github.com/graasp/graasp/commit/63199b1e970e42bc25d57d29dae9aad6361b1f53))
- "/items" plugins should load before main routes ([9ea6f5d](https://github.com/graasp/graasp/commit/9ea6f5da100068dff6cddb2146687628fc957532))
- "app" tests ([c0e1778](https://github.com/graasp/graasp/commit/c0e1778ea37ac408ed1828977603258d53a593f8))
- abstract to base task; refactor ([f728aa5](https://github.com/graasp/graasp/commit/f728aa53acc221921bb3ecb633630d09748f4c13))
- add 'purgeBelow' to del membership schema ([a3d54fe](https://github.com/graasp/graasp/commit/a3d54fe685db1935e7a41d7e2e372dd482607d71))
- add /m/register; some refactoring ([31d3fd7](https://github.com/graasp/graasp/commit/31d3fd7937cb406bf52cdbf713d8517780922a23))
- add await ([42efa46](https://github.com/graasp/graasp/commit/42efa46a2de6c30b2f75b9fcffad2e38043485a8))
- add branch for item flagging plugin dependency ([5940ed4](https://github.com/graasp/graasp/commit/5940ed4d7a1a429d30f13523cef7c8e2bfa0c9ae))
- add email lowercasing for token based registration ([0c06bd8](https://github.com/graasp/graasp/commit/0c06bd8a2c25b87c212a7c1812a6117ea133bfc4))
- add eslint-config-prettier as recommended ([012f48b](https://github.com/graasp/graasp/commit/012f48b64bcec1454a7ac00f9a58fb2355aac238))
- add missing property from interface ([c7b5cbd](https://github.com/graasp/graasp/commit/c7b5cbddc50442474aa54fe807c94f905f9b46ab))
- add new awslogs-group to nudenet container ([989732c](https://github.com/graasp/graasp/commit/989732c92e70e686a62f34315e22deeb496d5a61))
- add options to plugin recycle bin ([9a9f430](https://github.com/graasp/graasp/commit/9a9f4303c249959ec008ded5b3946c6ef654d0c9))
- add plugin options ([e978b16](https://github.com/graasp/graasp/commit/e978b16d6590334996abcb9bc04e5dfd0df45611))
- add regex to allow all localhost apps ([9823a6b](https://github.com/graasp/graasp/commit/9823a6ba314048fe07b4d6db461227d5c5795434))
- adjust test after "get many" items ([b6dcba2](https://github.com/graasp/graasp/commit/b6dcba289d21b58ff83de9492ce369470a3a590d))
- allow "additional props" in idParam schema ([0cf2110](https://github.com/graasp/graasp/commit/0cf2110a51698c6de70852b9e7834c68258e277d))
- allow CORS from all origins ([3f7826c](https://github.com/graasp/graasp/commit/3f7826cba5c2ea5e8d3c583f066853cd060a4fe1))
- allows the route taking an array as param to also take single param ([53d9d1a](https://github.com/graasp/graasp/commit/53d9d1a3eda63bf27ed4ef565f7ab7f88cf55c0a))
- always save email addresses as lowercase ([26339a8](https://github.com/graasp/graasp/commit/26339a84613263b8c20e8bf0e01aabe4c034b100))
- await for plugins registration ([f5d9c1a](https://github.com/graasp/graasp/commit/f5d9c1af47c8c24e184e8aaa8d2531b1bf6acb50))
- big refactor ([13a7308](https://github.com/graasp/graasp/commit/13a73089fa0ccb848693fc1ce7891b30a395ea98))
- call create/delete item membership hooks ([1d34218](https://github.com/graasp/graasp/commit/1d34218070861a64d1e91c287fb8c0b4bab32e41)), closes [#37](https://github.com/graasp/graasp/issues/37)
- call membership ws hooks registration ([ef9a760](https://github.com/graasp/graasp/commit/ef9a76079cd63c7a014f347f94fb2a0f11506a73))
- change env vars for "compose" in docker compose staging ([8b8850d](https://github.com/graasp/graasp/commit/8b8850db625271b8e62f7b53f49e891e2085f325))
- change item login link to point to the right file ([feda1c7](https://github.com/graasp/graasp/commit/feda1c72276ea966ed89040a29b83b590a7bf21a))
- change plugin loading order because of dependencies ([ea7e219](https://github.com/graasp/graasp/commit/ea7e219cc1fbadebda4f3c39b010b9d3233da465))
- change return type of copy's getDescendants() ([06940e8](https://github.com/graasp/graasp/commit/06940e8596a1414cfc1b78544790db5fd02ba1e7))
- clean memberships below when updat/creating 1 ([cf158f1](https://github.com/graasp/graasp/commit/cf158f106b0dcc9ec8b9da6964a440b08dfec362)), closes [#11](https://github.com/graasp/graasp/issues/11)
- correction to previous refactor ([22c5453](https://github.com/graasp/graasp/commit/22c5453d80643c75b3dc31f014f59ad817bb7ac2))
- correctly implement item in base-item ([472d5be](https://github.com/graasp/graasp/commit/472d5be98a7a90bb6c81262d2fadeb6ec513510d))
- create necessary tasks for refactor, update graasp dependencies ([2922e1a](https://github.com/graasp/graasp/commit/2922e1a27c7fba2927befdb3180b4ab8e4bde14f))
- default extra to {} in new item creation ([30c66df](https://github.com/graasp/graasp/commit/30c66dfe191714ad10ca26dc603e2f6d0843499e))
- discard extra if content not matching item type ([9f840ea](https://github.com/graasp/graasp/commit/9f840eac9e6f33bf2a07019c474c90d9520bc953))
- email link to open a page w a deep link ([4a128e6](https://github.com/graasp/graasp/commit/4a128e6a64d4c6619d472e27112925a4694aeced))
- enable CORS for dev environnement ([81dd89f](https://github.com/graasp/graasp/commit/81dd89f191920e73fede2d6e576c288fa8c6f7d0))
- error on get member item membership over item ([#187](https://github.com/graasp/graasp/issues/187)) ([58844b7](https://github.com/graasp/graasp/commit/58844b79292f125170315d754c87282eb896e7c8))
- execute hookhandlers where necessary ([f0baf14](https://github.com/graasp/graasp/commit/f0baf14141833ccd0ee374078b844579a3958cab)), closes [#38](https://github.com/graasp/graasp/issues/38)
- fix package ([f0277b0](https://github.com/graasp/graasp/commit/f0277b092312d963914dcbef0c3baa2419fc6fff))
- fix package.json ([caca6ae](https://github.com/graasp/graasp/commit/caca6ae9aec9a753ba87b6c6d5a885bd7376bd5b))
- fix rebase ([aa7bddd](https://github.com/graasp/graasp/commit/aa7bddd6492195df0694be7da891af54e2f69602))
- fix tests ([70a18e7](https://github.com/graasp/graasp/commit/70a18e71daa73fd21a4f33c9fcac97dc7302b209))
- fix tests for get own items ([53dcdd9](https://github.com/graasp/graasp/commit/53dcdd9c4275ec30f47711ee0f47e4e5f511c505))
- get file storage path from config ([08e6bbf](https://github.com/graasp/graasp/commit/08e6bbf01240fd8c277039f0cfd2dc80cf743990))
- get MAILER_CONFIG_FROM_EMAIL from env ([fca6fdd](https://github.com/graasp/graasp/commit/fca6fdd8f3b9af6179d139fd0b01dc1e10f15e5c)), closes [#44](https://github.com/graasp/graasp/issues/44)
- get own items calls postHookHandler ([1991a1d](https://github.com/graasp/graasp/commit/1991a1d62ae8a7e6dee011d28fb339e4bbcc5b11))
- graasp-file-item config options; update package-lock.json ([5bec6ca](https://github.com/graasp/graasp/commit/5bec6cab0543191a50e80491d836e6e842fde375))
- improve auth for apps ([35e1180](https://github.com/graasp/graasp/commit/35e11805822b5f50d27521632ec701b451485da7)), closes [#40](https://github.com/graasp/graasp/issues/40)
- improve shared items query ([549ad72](https://github.com/graasp/graasp/commit/549ad72748a6433a8c6d0e1393891329615c3973))
- improve some schemas; refactoring ([28071cd](https://github.com/graasp/graasp/commit/28071cdc04736f52ddc81a042bf7856855367d25))
- improved verification of credentials ([c8e8d86](https://github.com/graasp/graasp/commit/c8e8d8685bce26637a5f9535abc81ff24093cc29))
- include changes after review ([890f160](https://github.com/graasp/graasp/commit/890f1609c2650d61f288aece0111626c40d65fd5))
- include changes after review ([395ef0a](https://github.com/graasp/graasp/commit/395ef0a76639f348df2f7ce6f470f77ff10f1e54))
- include changes after review ([de55de1](https://github.com/graasp/graasp/commit/de55de11875f4f33e7305e07acb5e22d00130e6a))
- include changes after review ([1e9cf76](https://github.com/graasp/graasp/commit/1e9cf764a825512fa45ade70e0a2b0c11c63cf41))
- include test in formatting ([40b39ba](https://github.com/graasp/graasp/commit/40b39bab384c669f4299393831b5889aa96b97d8))
- inject handlers, update dependencies ([fb22a85](https://github.com/graasp/graasp/commit/fb22a8578ac8283e18c298c311706e2a2c1a7819))
- inject hookhandlers to all (sub)tasks ([e4c7b07](https://github.com/graasp/graasp/commit/e4c7b079c14dcc847334d11620ee2414ea5ff2ba))
- item copy new parent permission check ([9c8ac74](https://github.com/graasp/graasp/commit/9c8ac74b287d5e793e88e6e72e21be2bdd4845e4))
- let server crash if websockets is not initialized but WEBSOCKETS_PLUGIN is set ([9891af2](https://github.com/graasp/graasp/commit/9891af2fad5012b733b26c7e983459465c3a6773))
- logging improvements; refactoring. ([8e11402](https://github.com/graasp/graasp/commit/8e114022d0ac00c4d8e2845368f8b378c7d4a7ae))
- minor bug fix ([c443331](https://github.com/graasp/graasp/commit/c443331b79204794d5ce8a55c8f04bece4c11683))
- minor fix in schema ([1625bac](https://github.com/graasp/graasp/commit/1625bacd83e6e749229201cc6d50fa26cb2af54b))
- move plugin to public ([b2b7533](https://github.com/graasp/graasp/commit/b2b7533cba7adeb9f7bebca7ade0b6ac6b589f1d))
- origin cant be \* w/ fetch's "credentials:true" ([c47d708](https://github.com/graasp/graasp/commit/c47d708d2faaf6acb32d324d982c649221c51088))
- pass actor to task hook handlers ([c0c4781](https://github.com/graasp/graasp/commit/c0c4781aa0a4918eb8e38ac6f4c0896b5f5366ad))
- pass request's logger to task hookHandlers ([f2dee3d](https://github.com/graasp/graasp/commit/f2dee3dddb0dda38b9c3f73360eb592947792a14))
- properly serialize "many" resp w/ errored tasks results ([51444a3](https://github.com/graasp/graasp/commit/51444a3452f19c164dd468ae8408db6f936cff5a))
- reactor task execution and hooks setting ([72dd1b7](https://github.com/graasp/graasp/commit/72dd1b7de9854e8d1e680c445fed1510fbf4e9bb))
- rebase branch ([e5b969e](https://github.com/graasp/graasp/commit/e5b969efa7584e96b04cf8899ffd68bfde09712a))
- redirect to client after auth ([8a41190](https://github.com/graasp/graasp/commit/8a411903c24ba0651a23a1f74cc3d3034db9dfca))
- refactor auth to match member service changes ([4279db7](https://github.com/graasp/graasp/commit/4279db7e44d5123bdb0287f8d6e078453c3cfcd1))
- refactor db services (member, item) and clients ([e2b0415](https://github.com/graasp/graasp/commit/e2b04152ccaa626671b1a3ad339b0a19f4381452))
- refactor error handling and client exposure ([4d6dbd3](https://github.com/graasp/graasp/commit/4d6dbd3fc2b304f01e192145f23c4806bd8480ef))
- refactor graasp errors ([c01f140](https://github.com/graasp/graasp/commit/c01f140a0078d21d357e20c5afabdea69362215e))
- refactor hook handlers signatures ([e119b40](https://github.com/graasp/graasp/commit/e119b40af061a83400bd5a743e9f852ae55dc0d3))
- refactor item-memberships service to new types ([4cbaffc](https://github.com/graasp/graasp/commit/4cbaffcf7ea2ce45e8291717b99fd45c15077851))
- refactor items service to new types ([0bc5ae9](https://github.com/graasp/graasp/commit/0bc5ae9e30e63d42335657488fc60f0edc0ab6a7))
- refactor members service to new types ([b629081](https://github.com/graasp/graasp/commit/b62908135f915515d6ec3e90a55566d57bbc52c4))
- refactor tasks filenames ([b41db91](https://github.com/graasp/graasp/commit/b41db91eee23210ca6b2757f6b368c2d0fbce880))
- refactor TaskStatus from enum to set of string values ([aaef439](https://github.com/graasp/graasp/commit/aaef439b035b40b2f9c2bdc0730cc092f46f16cc))
- refactor; add schema for 'shortcut' ([2d0bbc0](https://github.com/graasp/graasp/commit/2d0bbc05431df1197de61d757b19e4672f0166ea))
- refactor/fix config ([758c50d](https://github.com/graasp/graasp/commit/758c50dd3e9241d052021f2e6d290f21b5f9335f)), closes [#43](https://github.com/graasp/graasp/issues/43)
- register graasp-apps 1st ([dfa4d54](https://github.com/graasp/graasp/commit/dfa4d54b4d1b2cad329b8c0613ba6a33138e5ce1))
- remove duplicate registerwshooks ([d07045e](https://github.com/graasp/graasp/commit/d07045e5a46cd6039212e6d09ba08ab796de2b5e))
- remove email challenge schema ([dead939](https://github.com/graasp/graasp/commit/dead93986e79fe5c61784b63109119bfe70a57cd)), closes [#47](https://github.com/graasp/graasp/issues/47)
- remove lang in loginpassword and minor changes ([57fbdd7](https://github.com/graasp/graasp/commit/57fbdd7747a656a47aa2556086936606d97410b7))
- remove password null check in register and update tests ([5d00310](https://github.com/graasp/graasp/commit/5d00310f0197c7848c891cd21e446d4bfe180b43))
- remove port forwarding for redis and add password setting command ([45f4dae](https://github.com/graasp/graasp/commit/45f4dae42b0d0dc6109c570b3ac0d15d14696b22))
- remove unnecessary async clause ([a1f98e2](https://github.com/graasp/graasp/commit/a1f98e233346407cb24a464c31debf5b260e0037))
- rename .prettierrc ([067c1d0](https://github.com/graasp/graasp/commit/067c1d03987b80e2d6af676dfe8f67884a50395e))
- rename endpoint ([717d680](https://github.com/graasp/graasp/commit/717d68030f037fe272d282e90bd66b23e10caf3b))
- replug graasp plugins; add fastify-compress ([94efbb7](https://github.com/graasp/graasp/commit/94efbb7d8471a6a4f34421c85ae578493f916584))
- ret 204 when re-registering existing email ([6d0cbe6](https://github.com/graasp/graasp/commit/6d0cbe655bdc4a53e2108b6486a2f75f445354d6)), closes [#51](https://github.com/graasp/graasp/issues/51)
- return 204 when re-registering existing email ([a5077fd](https://github.com/graasp/graasp/commit/a5077fded6f8d8333d01f6cb343ea427d15a1bc8)), closes [#51](https://github.com/graasp/graasp/issues/51)
- return delete subtask if updated membership = inherited ([4dee29f](https://github.com/graasp/graasp/commit/4dee29f1caa99d958ed2ee00e0287742524ad816))
- runner and task new types ([2be40cf](https://github.com/graasp/graasp/commit/2be40cfa3c3bcf0b856aee318136357129493280))
- scope onResponse with core routes ([#178](https://github.com/graasp/graasp/issues/178)) ([c2cd81a](https://github.com/graasp/graasp/commit/c2cd81ab8475122ef1adbf9d4fd1255d98d66e69))
- send login mail if register existing email ([a712a3a](https://github.com/graasp/graasp/commit/a712a3a704d42e6eac7fc30898129c34d122f42c))
- set session cookie as Samesite:lax in staging ([3f34500](https://github.com/graasp/graasp/commit/3f34500ddc4726033afde606bcdf5c2c68cc93bb))
- small refactoring ([ede98d9](https://github.com/graasp/graasp/commit/ede98d9b71dd24defad87bca75824f3d9e25eb70))
- some small refactoring ([0d381a5](https://github.com/graasp/graasp/commit/0d381a5967c59ca0e228ed8168b630f2a51f9075))
- subtasks to have the same name as main tasks ([455eee4](https://github.com/graasp/graasp/commit/455eee4422a02447cec5e4ee00050b73efe313d5))
- task as DELEGATED if execution goes to subtasks ([d3ec2ff](https://github.com/graasp/graasp/commit/d3ec2ffec423394cc882e3e39bcbfb947e313412))
- task result from subtasks results ([08d90b2](https://github.com/graasp/graasp/commit/08d90b27608da87dcee21c6d818dabed8699fd20))
- task tests typing; refactor ([edbaf8b](https://github.com/graasp/graasp/commit/edbaf8be95459b4d89bf80078115ad08d69ab8fe)), closes [#34](https://github.com/graasp/graasp/issues/34)
- tasks need to pass hook handlers to sub-tasks ([b3fbb15](https://github.com/graasp/graasp/commit/b3fbb1594c77a31afe6e2a70e6e12f521b40c770))
- this add the ability to preserve previous values in settings ([bfbbf50](https://github.com/graasp/graasp/commit/bfbbf505dbc0e7852317b4818b3a78813ac67f31))
- tiny refactor ([e45dcaa](https://github.com/graasp/graasp/commit/e45dcaa84a823790f52b468532f1fa2ee1e262b9))
- update db-schema.sql ([dce128a](https://github.com/graasp/graasp/commit/dce128a35ebc24b7ef542f673a2738905bd02ae4))
- update db-schema.sql ([2388219](https://github.com/graasp/graasp/commit/23882191512fb5bd9a3c1534c58aa7bed3dfe7b7))
- update exposed types and modify how they're generated ([08031e6](https://github.com/graasp/graasp/commit/08031e67f5fe16c0c4a813290207daf9ad2b5f06))
- update exposed types; refactor ([ede7779](https://github.com/graasp/graasp/commit/ede7779640a71461c0cb4299252e63ce6ff576d7))
- update hookhandlers invocation in certain tasks ([3fe328c](https://github.com/graasp/graasp/commit/3fe328cc5ee7962d1e992fbed5ef0e1c1cb88cec))
- update jsonwebtoken import ([a387029](https://github.com/graasp/graasp/commit/a38702905027359250d11f93b9502492fdaa7a47))
- update options for plugin recycle bin ([201d5dd](https://github.com/graasp/graasp/commit/201d5dd632147fcc7f188f296c53e02e218b209e))
- update package-lock.json ([0a3b551](https://github.com/graasp/graasp/commit/0a3b55175cd50fc35df5210b531ed696b3f263e7))
- update sha ref ([8d9df01](https://github.com/graasp/graasp/commit/8d9df01f5ee38532eaa2cbd5d153fd5a9391c2b0))
- update thumbnails deps ([9f60982](https://github.com/graasp/graasp/commit/9f60982da451ec7ba5ee58fe8aea7ee38c37cc57))
- update yarn lock ([2b78ade](https://github.com/graasp/graasp/commit/2b78ade07c9654bcff377e2c54659eb9a99adc89))
- updates routes names ([77e1376](https://github.com/graasp/graasp/commit/77e13767e4d7c5e20d6c159e9bbbb798cb755965))
- updates to extra if matching item type ([d1dcebe](https://github.com/graasp/graasp/commit/d1dcebe4ac51b9b26faf5b8573e19f88880805c1))
- use request's logger instance for tasks exec ([42855ee](https://github.com/graasp/graasp/commit/42855eefaf34da305b298a908ac367890335bd8d))
