(function () {
  'use strict';

  var navToggle = document.getElementById('navToggle');
  var mainNav = document.getElementById('mainNav');

  function setNavOpen(open) {
    if (!mainNav || !navToggle) return;
    mainNav.classList.toggle('is-open', open);
    navToggle.classList.toggle('is-active', open);
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('nav-open', open);
  }

  if (navToggle && mainNav) {
    navToggle.addEventListener('click', function () {
      setNavOpen(!mainNav.classList.contains('is-open'));
    });

    mainNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        setNavOpen(false);
      });
    });

    document.body.addEventListener('click', function (e) {
      if (!mainNav.classList.contains('is-open')) return;
      if (mainNav.contains(e.target) || navToggle.contains(e.target)) return;
      setNavOpen(false);
    });
  }

  fetch('design.json')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data || !data.site || !data.site.stats) return;
      var stats = data.site.stats;
      var map = {
        institutions: stats.institutions,
        professionals: stats.professionals,
        shifts: stats.shifts,
        states: stats.states
      };
      Object.keys(map).forEach(function (key) {
        document.querySelectorAll('[data-stat="' + key + '"]').forEach(function (el) {
          if (map[key]) el.textContent = map[key];
        });
      });
    })
    .catch(function () {});

  var exitPopup = document.getElementById('exitPopup');
  var exitClose = document.getElementById('exitPopupClose');
  var exitShown = false;

  function showExitPopup() {
    if (exitShown || !exitPopup || sessionStorage.getItem('viva_exit_popup')) return;
    exitShown = true;
    sessionStorage.setItem('viva_exit_popup', '1');
    exitPopup.hidden = false;
  }

  if (exitPopup) {
    document.addEventListener('mouseleave', function (e) {
      if (e.clientY <= 0) showExitPopup();
    });
    if (exitClose) {
      exitClose.addEventListener('click', function () {
        exitPopup.hidden = true;
      });
    }
    exitPopup.querySelector('.exit-popup-backdrop')?.addEventListener('click', function () {
      exitPopup.hidden = true;
    });
    var exitCta = document.getElementById('exitPopupCta');
    if (exitCta) {
      exitCta.addEventListener('click', function () {
        exitPopup.hidden = true;
      });
    }
  }
})();
