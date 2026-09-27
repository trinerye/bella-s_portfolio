# Portfolio

A static portfolio website: plain HTML, CSS and JavaScript, with no build step.

| Page | File |
| --- | --- |
| Work (home) | `index.html` |
| About | `about.html` |
| Contact | `contact.html` |
| Rights & Privacy | `rights.html` |

Every page's footer links **“All rights reserved.”** to `rights.html`. The newsletter's **Privacy Policy** link goes to `rights.html#privacy`.

## Editing

- Replace the `[bracketed]` placeholders with your own content.
- Set your email address in `CONTACT_EMAIL` at the top of `js/main.js` and in the `mailto:` links. The contact form opens the visitor's email app with the message already filled in.
- Testimonials are listed in `js/main.js`.
- All styles are in `css/styles.css`.

## Viewing locally

Open `index.html` in a browser, or run `python3 -m http.server` and go to http://localhost:8000.

## Publishing

The site works on any static host. For GitHub Pages: go to **Settings → Pages**, choose **Deploy from a branch**, and select the branch and `/ (root)`.
