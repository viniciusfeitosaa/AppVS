/**
 * animations.js
 * Animações ao scroll usando Intersection Observer
 */
(function () {
  'use strict';

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { root: null, rootMargin: '0px', threshold: 0.12 }
  );

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-animate], .steps-timeline').forEach(function (el) {
      observer.observe(el);
    });
  });
})();
