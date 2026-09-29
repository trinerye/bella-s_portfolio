// Shared behaviour for every page: testimonials carousel, image carousels, services accordion,
// contact form (opens the visitor's mail app) and newsletter sign-up.
(function () {
  'use strict';

  // Update this to your real address – it is used by every contact form.
  var CONTACT_EMAIL = 'hello@example.com';

  // ---- Footer year ----
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  // ---- Testimonials ----
  var quotes = [
    { quote: '[A short quote from a happy client about working with you.]', name: '[Client name]', role: '[Role, Company]' },
    { quote: '[Another testimonial – what you delivered and how it felt to work together.]', name: '[Client name]', role: '[Role, Company]' },
    { quote: '[A third testimonial from a returning client.]', name: '[Client name]', role: '[Role, Company]' }
  ];

  document.querySelectorAll('[data-testimonials]').forEach(function (root) {
    var i = 0;
    var q = root.querySelector('[data-quote]');
    var name = root.querySelector('[data-name]');
    var role = root.querySelector('[data-role]');
    function render() {
      q.textContent = '“' + quotes[i].quote + '”';
      name.textContent = quotes[i].name;
      role.textContent = quotes[i].role;
    }
    root.querySelector('[data-prev]').addEventListener('click', function () {
      i = (i + quotes.length - 1) % quotes.length;
      render();
    });
    root.querySelector('[data-next]').addEventListener('click', function () {
      i = (i + 1) % quotes.length;
      render();
    });
    render();
  });

  // ---- About Me: line up the bottom of the dropdown column with the text ----
  // The gap is measured only while every dropdown is closed and then kept fixed,
  // so opening one never makes the items above it jump.
  var about = document.getElementById('about');
  var aboutText = about && about.querySelector('.about-text');
  var aboutCol = about && about.querySelector('.services');
  var skills = about && about.querySelector('.skill-groups');
  if (aboutText && aboutCol && skills) {
    var fitSkills = function () {
      if (aboutCol.querySelector('[aria-expanded="true"], details[open]')) return;
      skills.style.marginTop = '0px';
      var sideBySide = Math.abs(aboutText.getBoundingClientRect().top - aboutCol.getBoundingClientRect().top) < 2;
      var extra = aboutText.getBoundingClientRect().height - aboutCol.getBoundingClientRect().height;
      skills.style.marginTop = sideBySide && extra > 0 ? extra + 'px' : '0px';
    };
    fitSkills();
    window.addEventListener('resize', fitSkills);
    if (document.fonts) document.fonts.ready.then(fitSkills);
  }

  // ---- Carousels: image and text slides change together ----
  document.querySelectorAll('[data-carousel]').forEach(function (root) {
    var images = root.querySelectorAll('.carousel__media [data-slide]');
    var texts = root.querySelectorAll('.carousel__texts [data-slide]');
    var current = root.querySelector('[data-carousel-current]');
    var i = 0;
    function show(n) {
      i = (n + texts.length) % texts.length;
      [images, texts].forEach(function (set) {
        set.forEach(function (el, k) { el.classList.toggle('is-active', k === i); });
      });
      current.textContent = String(i + 1).padStart(2, '0');
    }
    root.querySelector('[data-carousel-prev]').addEventListener('click', function () { show(i - 1); });
    root.querySelector('[data-carousel-next]').addEventListener('click', function () { show(i + 1); });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') show(i - 1);
      if (e.key === 'ArrowRight') show(i + 1);
    });
  });

  // ---- Services accordion (one open at a time) ----
  var toggles = Array.prototype.slice.call(document.querySelectorAll('.service__toggle'));
  toggles.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var willOpen = btn.getAttribute('aria-expanded') !== 'true';
      toggles.forEach(function (other) {
        var open = other === btn && willOpen;
        other.setAttribute('aria-expanded', String(open));
        document.getElementById(other.getAttribute('aria-controls')).hidden = !open;
      });
    });
  });

  // ---- Contact forms: compose an email in the visitor's mail app ----
  document.querySelectorAll('form[data-contact-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = form.elements;
      var subject = f.inquiry.value + ' – ' + f.first.value + ' ' + f.last.value;
      var body = f.message.value + '\n\n' + f.first.value + ' ' + f.last.value + '\n' + f.email.value;
      window.location.href = 'mailto:' + CONTACT_EMAIL +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);
      form.querySelector('.form-status').textContent = 'Opening your email app… Thanks for reaching out!';
      form.reset();
    });
  });

  // ---- Newsletter ----
  document.querySelectorAll('form[data-newsletter]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      form.parentNode.querySelector('.form-status').textContent = 'Thanks! You’re on the list.';
      form.reset();
    });
  });
})();
