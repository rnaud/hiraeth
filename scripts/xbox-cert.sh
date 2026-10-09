#!/usr/bin/env bash
# The Xbox app's signing certificate (docs/systems/xbox.md, "Signing"), made once on the Mac with openssl:
# a self-signed code-signing certificate whose subject is the manifest's Publisher (CN=Hiraeth Xbox Dev), as a
# .pfx in .local-tools/xbox-signing/ (git-ignored: keep the backup, like the Android key) and its .cer.
# Then it sets the repository secrets XBOX_PFX_BASE64 and XBOX_PFX_PASSWORD with gh (or prints how).
#
#   scripts/xbox-cert.sh            make it (refuses to replace one that exists)
#   scripts/xbox-cert.sh --secrets  only set the secrets again from the existing one
#
# Every package signed with the same certificate installs over the last and keeps the saves; a new certificate
# means removing the app on the console first (and its saves with it).
set -euo pipefail
cd "$(dirname "$0")/.."
DIR=.local-tools/xbox-signing
PFX=$DIR/hiraeth-xbox.pfx
CER=$DIR/hiraeth-xbox.cer
PASSFILE=$DIR/password.txt
SUBJECT='/CN=Hiraeth Xbox Dev'

set_secrets() {
  if command -v gh >/dev/null 2>&1; then
    base64 < "$PFX" | tr -d '\n' | gh secret set XBOX_PFX_BASE64
    gh secret set XBOX_PFX_PASSWORD < "$PASSFILE"
    echo "Set the repository secrets XBOX_PFX_BASE64 and XBOX_PFX_PASSWORD."
  else
    echo "gh isn't installed: set the repository secrets by hand:"
    echo "  XBOX_PFX_BASE64    = the output of: base64 < $PFX | tr -d '\\n'"
    echo "  XBOX_PFX_PASSWORD  = the contents of $PASSFILE"
  fi
}

if [ "${1:-}" = "--secrets" ]; then set_secrets; exit 0; fi
if [ -e "$PFX" ]; then echo "$PFX exists already (scripts/xbox-cert.sh --secrets sets the secrets from it)"; exit 1; fi

mkdir -p "$DIR"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
openssl rand -hex 16 > "$PASSFILE"
cat > "$work/cert.cnf" <<'EOF'
[req]
distinguished_name = dn
x509_extensions = ext
prompt = no
[dn]
CN = Hiraeth Xbox Dev
[ext]
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature
extendedKeyUsage = codeSigning
subjectKeyIdentifier = hash
EOF
openssl req -x509 -newkey rsa:3072 -sha256 -days 3650 -nodes -keyout "$work/key.pem" -out "$work/cert.pem" -config "$work/cert.cnf"
# (3DES and SHA-1 for the .pfx's own encryption: every Windows tool imports it; the signature itself is SHA-256)
openssl pkcs12 -export -inkey "$work/key.pem" -in "$work/cert.pem" -out "$PFX" -name 'Hiraeth Xbox' \
  -certpbe PBE-SHA1-3DES -keypbe PBE-SHA1-3DES -macalg sha1 -passout "file:$PASSFILE"
openssl x509 -in "$work/cert.pem" -outform der -out "$CER"
echo "Made $PFX (subject $SUBJECT, ten years) and $CER; the password is in $PASSFILE."
set_secrets
