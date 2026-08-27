// cv plugin — the print fallback, and nothing else.
//
// A CV with a PDF attached has a real download link, built into the page and
// working without JavaScript. A CV without one gets the same button wired to
// the browser's print dialog — which needs JavaScript, so the button stays
// hidden (client.css) until this runs and marks it ready.

const options = JSON.parse(document.getElementById('plugin-options')?.textContent || '{}').cv || {};

for (const button of document.querySelectorAll('a[data-cv-print]')) {
  button.setAttribute('role', 'button');
  button.tabIndex = 0;
  button.addEventListener('click', () => window.print());
  button.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); window.print(); }
  });
  button.classList.add('cv-print-ready');
}
