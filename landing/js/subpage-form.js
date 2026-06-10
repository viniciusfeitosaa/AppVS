(function () {
  'use strict';
  var WA = '551140402345';
  document.querySelectorAll('[data-wa-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var lines = ['Olá! Vim pelo site Viva Saúde.', ''];
      var valid = true;
      form.querySelectorAll('[name]').forEach(function (input) {
        var v = (input.value || '').trim();
        if (input.required && !v) valid = false;
        if (v && input.name) lines.push(input.labels?.[0]?.textContent?.replace(':', '') || input.name + ': ' + v);
        else if (v) lines.push(input.name + ': ' + v);
      });
      if (!valid) {
        alert('Preencha os campos obrigatórios.');
        return;
      }
      window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener');
    });
  });
})();
