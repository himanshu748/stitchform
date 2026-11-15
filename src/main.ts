// Placeholder entry point. The lab UI (F8) replaces this once the specs are written.
const root = document.querySelector<HTMLDivElement>('#app');

if (root) {
  const heading = document.createElement('h1');
  heading.textContent = 'Stitchform';

  const status = document.createElement('p');
  status.textContent = 'Work in progress. Nothing you do here leaves your browser.';

  root.append(heading, status);
}
