/* Compatibility-first page runtime.
 * The original runtime is kept intact in one external file so inline HTML
 * hooks, existing IDs, storage keys and legacy globals remain compatible.
 */
const runtime = document.createElement('script');
runtime.src = 'js/customer/runtime.js';
runtime.defer = false;
document.body.appendChild(runtime);
