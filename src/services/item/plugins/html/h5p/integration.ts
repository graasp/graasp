// /**
//  * Renders the integration HTML for H5P in Graasp
//  * @param h5pAssetsBaseUrl Root url where the H5P runtime is located
//  * @param h5pContentBaseUrl Root url where the H5P packages are stored (the subfolders are expected to be named by content ID, which each contain the relevant extracted H5P package)
//  * @param h5pHostDomains Hostnames where the integration should be allowed (domain(s) name(s) of the caller which will display this source)
//  * @returns The rendered H5P integration HTML
//  */
// export const renderHtml = (
//   h5pAssetsBaseUrl: string,
//   h5pContentBaseUrl: string,
//   h5pHostDomains: Array<string>,
// ) => `
// <!DOCTYPE html>
// <html>
//   <head>
//     <script type="text/javascript" src="${h5pAssetsBaseUrl}/main.bundle.js"></script>
//   </head>

//   <body>
//     <div id="h5p-root"></div>
//     <script type="text/javascript">
//       function initH5P() {
//         const targetOrigins = [
//           ${h5pHostDomains.map((host) => `"${host}"`).join(',\n')}
//         ];

//         const queryParams = new URLSearchParams(window.location.search);
//         const contentId = decodeURIComponent(queryParams.get('content'));
//         const uuidRegex =
//           /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
//         if (!contentId.match(uuidRegex)) {
//           return;
//         }

//         const options = {
//           h5pJsonPath: new URL(\`${h5pContentBaseUrl}/\$\{contentId\}/content\`).href,
//           frameJs: '${h5pAssetsBaseUrl}/frame.bundle.js',
//           frameCss: '${h5pAssetsBaseUrl}/styles/h5p.css',
//         };
//         const el = document.getElementById('h5p-root');
//         new H5PStandalone.H5P(el, options);

//         const targets = targetOrigins.map((o) => new URL(o).origin);
//         const resizeObserver = new ResizeObserver((entries) => {
//           for (let entry of entries) {
//             for (let target of targets) {
//               const height = entry.contentRect.height;
//               window.parent.postMessage({ contentId, height }, target);
//             }
//           }
//         });
//         resizeObserver.observe(el);
//       }

//       initH5P();
//     </script>
//   </body>
// </html>
// `;
