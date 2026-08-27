// cv plugin — the print button, and nothing else.
//
// Pure progressive enhancement: the CV itself is static HTML from the build,
// and a browser can print it with Ctrl/Cmd-P whether or not this runs. A button
// that calls window.print() only makes sense when there's JavaScript to call
// it, so it's added here rather than baked into the page.

const options = JSON.parse(document.getElementById('plugin-options')?.textContent || '{}').cv || {};
const cv = document.querySelector('.plain-cv');

// A variant that links a real PDF file already has its own download link.
if (cv && options.printButton !== false && !cv.querySelector('.cv-pdf')) {
  const contact = cv.querySelector('.cv-contact');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cv-print';
  button.textContent = options.printButtonLabel || 'Download PDF';
  button.addEventListener('click', () => window.print());

  if (contact) {
    const slot = document.createElement('li');
    slot.className = 'cv-action';
    slot.append(button);
    contact.append(slot);
  } else {
    cv.querySelector('.cv-identity')?.append(button);
  }
}
