// Barrel for the Tier 1 surfaces (design doc Part 4). Each `render` is
// re-exported under a surface-specific name to avoid collisions here, since
// every surface module names its own browser-mount stub `render`.

export { createTableSurface, render as renderTable } from './table.js';
export { createChartSurface, render as renderChart } from './chart.js';
export { createMapSurface, render as renderMap } from './map.js';
export { createFeedSurface, render as renderFeed } from './feed.js';
export { createFormSurface, render as renderForm } from './form.js';
