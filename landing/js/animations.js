/**
 * animations.js
 * Animações sofisticadas ao scroll usando Intersection Observer
 */
(function() {
  'use strict';

  // Intersection Observer para animações ao scroll
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        // Opcional: parar de observar após animar (performance)
        // observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observar todos os elementos com data-animate
  document.addEventListener('DOMContentLoaded', function() {
    const animatedElements = document.querySelectorAll('[data-animate]');
    animatedElements.forEach(function(el) {
      observer.observe(el);
    });
  });

  // Parallax suave no hero (opcional)
  let heroSection = null;
  let heroInner = null;

  window.addEventListener('load', function() {
    heroSection = document.querySelector('.hero');
    heroInner = document.querySelector('.hero-inner');
  });

  window.addEventListener('scroll', function() {
    if (!heroSection || !heroInner) return;
    
    const scrolled = window.pageYOffset;
    const heroHeight = heroSection.offsetHeight;
    
    if (scrolled < heroHeight) {
      const parallaxAmount = scrolled * 0.4;
      heroInner.style.transform = 'translateY(' + parallaxAmount + 'px)';
      heroInner.style.opacity = 1 - (scrolled / heroHeight) * 0.5;
    }
  });

  // Header flutuante com efeitos ao scroll
  let header = null;
  window.addEventListener('load', function() {
    header = document.querySelector('.header');
  });

  window.addEventListener('scroll', function() {
    if (!header) return;
    
    if (window.pageYOffset > 100) {
      header.style.background = 'rgba(255, 255, 255, 0.85)';
      header.style.backdropFilter = 'blur(28px) saturate(200%)';
      header.style.boxShadow = '0 12px 40px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08)';
      header.style.top = '1rem';
    } else {
      header.style.background = 'rgba(255, 255, 255, 0.75)';
      header.style.backdropFilter = 'blur(24px) saturate(180%)';
      header.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.06)';
      header.style.top = '1.5rem';
    }
  });

  // Toggle menu mobile
  document.addEventListener('DOMContentLoaded', function() {
    const navToggle = document.getElementById('navToggle');
    const mainNav = document.getElementById('mainNav');
    
    if (navToggle && mainNav) {
      navToggle.addEventListener('click', function() {
        const isOpen = mainNav.classList.toggle('is-open');
        navToggle.classList.toggle('is-active');
        navToggle.setAttribute('aria-expanded', isOpen);
        
        // Prevenir scroll quando menu aberto
        if (isOpen) {
          document.body.style.overflow = 'hidden';
        } else {
          document.body.style.overflow = '';
        }
      });
      
      // Fechar ao clicar em link
      const navLinks = mainNav.querySelectorAll('a');
      navLinks.forEach(function(link) {
        link.addEventListener('click', function() {
          mainNav.classList.remove('is-open');
          navToggle.classList.remove('is-active');
          navToggle.setAttribute('aria-expanded', 'false');
          document.body.style.overflow = '';
        });
      });
      
      // Fechar ao clicar fora
      document.addEventListener('click', function(e) {
        if (!mainNav.contains(e.target) && !navToggle.contains(e.target)) {
          if (mainNav.classList.contains('is-open')) {
            mainNav.classList.remove('is-open');
            navToggle.classList.remove('is-active');
            navToggle.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
          }
        }
      });
    }
  });
})();
