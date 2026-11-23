#!/bin/bash
# Retire le lancement automatique de Jarvis. Reda Rise et vos données ne sont pas touchés.
LABEL="fr.redastudio.jarvis"
DIR="$HOME/Library/Application Support/Jarvis"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist" "$DIR/lancer-jarvis.sh"
echo "Lancement automatique retiré."
printf "Supprimer aussi le profil du navigateur de Jarvis (connexion, micro) ? (o/n) "
read -r ALL || true
if [ "${ALL:-n}" = "o" ]; then rm -rf "$DIR"; echo "Profil supprimé."; fi
