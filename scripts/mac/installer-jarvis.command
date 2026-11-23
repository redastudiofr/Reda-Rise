#!/bin/bash
# Jarvis au démarrage du Mac : à chaque ouverture de session, une animation
# et un son, puis Jarvis lance son débrief, en plein écran, sans clic.
# Double-cliquez ce fichier (ou : bash installer-jarvis.command).
set -euo pipefail

LABEL="fr.redastudio.jarvis"
DIR="$HOME/Library/Application Support/Jarvis"
AGENT="$HOME/Library/LaunchAgents/$LABEL.plist"
DEFAULT_SITE="https://muscu-tracker-phi.vercel.app"

echo "=== Installation du lancement automatique de Jarvis ==="
echo
printf "Adresse de Reda Rise [%s] : " "$DEFAULT_SITE"
read -r SITE || true
SITE="${SITE:-$DEFAULT_SITE}"
SITE="${SITE%/}"
case "$SITE" in
  https://* | http://localhost:* | http://127.0.0.1:*) ;;
  *) echo "Adresse invalide : elle doit commencer par https://"; exit 1 ;;
esac

# Edge d'abord (voix « Natural »), Chrome sinon.
BROWSER=""
for app in "/Applications/Microsoft Edge.app" "$HOME/Applications/Microsoft Edge.app" "/Applications/Google Chrome.app"; do
  if [ -d "$app" ]; then BROWSER="$app"; break; fi
done
if [ -z "$BROWSER" ] && [ -z "${JARVIS_DRY_RUN:-}" ]; then
  echo "Microsoft Edge est introuvable. Installez-le depuis https://www.microsoft.com/edge puis relancez ce fichier."
  exit 1
fi
BROWSER="${BROWSER:-/Applications/Microsoft Edge.app}"

mkdir -p "$DIR" "$(dirname "$AGENT")"

# Le lanceur : attend le réseau, puis ouvre Jarvis dans une fenêtre d'appli à part.
# --autoplay-policy autorise le son et la voix sans clic (dans cette fenêtre seulement) ;
# le profil séparé garde votre connexion et l'autorisation du micro.
cat > "$DIR/lancer-jarvis.sh" <<LAUNCHER
#!/bin/bash
SITE="$SITE"
BROWSER="$BROWSER"
PROFILE="$DIR/profil-navigateur"
for i in \$(seq 1 90); do
  /usr/bin/curl -fsS -o /dev/null --max-time 3 "\$SITE/login" && break
  sleep 1
done
exec /usr/bin/open -na "\$BROWSER" --args \\
  --user-data-dir="\$PROFILE" \\
  --app="\$SITE/jarvis?boot=1" \\
  --start-fullscreen \\
  --autoplay-policy=no-user-gesture-required \\
  --no-first-run --no-default-browser-check
LAUNCHER
chmod 755 "$DIR/lancer-jarvis.sh"

cat > "$AGENT" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$DIR/lancer-jarvis.sh</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$DIR/lancement.log</string>
  <key>StandardErrorPath</key>
  <string>$DIR/lancement.log</string>
</dict>
</plist>
PLIST

if [ -n "${JARVIS_DRY_RUN:-}" ]; then
  echo "Essai à blanc : fichiers écrits dans $DIR et $AGENT"
  exit 0
fi

# Recharge l'agent (si une ancienne version était installée).
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$AGENT"

echo
echo "C'est installé. Jarvis s'ouvrira à chaque ouverture de session."
echo
echo "Première fois seulement, dans la fenêtre qui va s'ouvrir :"
echo "  1. connectez-vous avec le mot de passe de Reda Rise ;"
echo "  2. autorisez le micro (navigateur, puis macOS si demandé)."
echo
printf "Ouvrir Jarvis maintenant pour faire ces réglages ? (o/n) "
read -r NOW || true
if [ "${NOW:-o}" != "n" ]; then /bin/bash "$DIR/lancer-jarvis.sh"; fi
