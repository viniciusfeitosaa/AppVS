#!/usr/bin/env bash
# Desativa OTP (require_email_2fa) na 2.ª parte (Viva Saúde) em submissões DocuSeal já criadas.
# A API PUT do DocuSeal self-hosted nem sempre persiste esta preferência; o Rails console sim.
#
# Uso na VPS:
#   ./backend/scripts/fix-docuseal-second-party-2fa.sh
#   DOCUSEAL_CONTAINER=docuseal-app SECOND_EMAIL=contato@sejavivasaude.com.br ./backend/scripts/fix-docuseal-second-party-2fa.sh

set -euo pipefail

CONTAINER="${DOCUSEAL_CONTAINER:-docuseal-app}"
SECOND_EMAIL="${DOCUSEAL_SECOND_SUBMITTER_EMAIL:-contato@sejavivasaude.com.br}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Container DocuSeal '$CONTAINER' não encontrado." >&2
  exit 1
fi

echo "[fix-2fa] Container: $CONTAINER | 2.ª parte: $SECOND_EMAIL"

docker exec -w /app "$CONTAINER" bundle exec rails runner "
email = '${SECOND_EMAIL}'.strip.downcase
fixed = 0
Submitter.where('LOWER(email) = ?', email).find_each do |s|
  next if s.completed_at.present? || s.declined_at.present?
  next unless s.preferences['require_email_2fa'] == true
  s.preferences['require_email_2fa'] = false
  s.save!
  fixed += 1
  puts \"[ok] submitter ##{s.id} submission ##{s.submission_id}\"
end
puts \"[done] #{fixed} submitter(s) corrigido(s)\"
"
