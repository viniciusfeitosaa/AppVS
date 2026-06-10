(function () {
  'use strict';

  var WA_NUMBER = '551140402345';
  var form = document.getElementById('leadForm');
  if (!form) return;

  var whatsappInput = document.getElementById('leadWhatsapp');
  if (whatsappInput) {
    whatsappInput.addEventListener('input', function () {
      var digits = whatsappInput.value.replace(/\D/g, '').slice(0, 11);
      if (digits.length <= 10) {
        whatsappInput.value = digits
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{4})(\d)/, '$1-$2');
      } else {
        whatsappInput.value = digits
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{5})(\d)/, '$1-$2');
      }
    });
  }

  function showFeedback(msg, type) {
    var el = document.getElementById('formFeedback');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    el.className = 'form-feedback is-' + type;
  }

  function saveLeadLocal(data) {
    try {
      var leads = JSON.parse(localStorage.getItem('viva_leads') || '[]');
      data.at = new Date().toISOString();
      leads.push(data);
      localStorage.setItem('viva_leads', JSON.stringify(leads.slice(-50)));
    } catch (e) {}
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = (document.getElementById('leadName')?.value || '').trim();
    var role = (document.getElementById('leadRole')?.value || '').trim();
    var institution = (document.getElementById('leadInstitution')?.value || '').trim();
    var city = (document.getElementById('leadCity')?.value || '').trim();
    var whatsapp = (document.getElementById('leadWhatsapp')?.value || '').trim();

    if (!name || !role || !institution || !city || !whatsapp) {
      showFeedback('Preencha todos os campos obrigatórios.', 'error');
      return;
    }

    var digits = whatsapp.replace(/\D/g, '');
    if (digits.length < 10) {
      showFeedback('Informe um WhatsApp válido.', 'error');
      return;
    }

    var payload = { name: name, role: role, institution: institution, city: city, whatsapp: whatsapp };
    saveLeadLocal(payload);

    fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        role: role,
        institution: institution,
        city: city,
        whatsapp: whatsapp,
        source: 'landing-home'
      })
    }).catch(function () {});

    var text = [
      'Olá! Gostaria de agendar uma demonstração gratuita.',
      '',
      'Nome: ' + name,
      'Cargo: ' + role,
      'Instituição: ' + institution,
      'Cidade/Estado: ' + city,
      'WhatsApp: ' + whatsapp
    ].join('\n');

    showFeedback('Redirecionando para o WhatsApp… Nossa equipe entrará em contato em breve.', 'success');
    window.open('https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
  });
})();
