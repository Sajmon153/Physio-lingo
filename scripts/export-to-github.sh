#!/usr/bin/env bash
set -euo pipefail

# PhysioLingo — GitHub Export Helper
# Użycie:
#   ./scripts/export-to-github.sh https://github.com/<TWOJ_LOGIN>/<NAZWA_REPO>.git [main]

REPO_URL="${1:-}"
BRANCH="${2:-main}"

if [[ -z "$REPO_URL" ]]; then
  echo "Użycie: $0 <URL_REPOZYTORIUM_GITHUB> [gałąź=main]"
  echo "Przykład: $0 https://github.com/twoj-login/physiolingo.git main"
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "[BŁĄD] Nie znaleziono narzędzia 'git' w systemie."
  echo "Zainstaluj git poleceniem:"
  echo "  sudo apt update && sudo apt install -y git"
  exit 1
fi

if [[ -z "$(git config --global user.name || true)" || -z "$(git config --global user.email || true)" ]]; then
  echo "[BŁĄD] Brak skonfigurowanego podpisu autora w git."
  echo "Ustaw imię/login i e-mail powiązany z GitHub:"
  echo '  git config --global user.name "Twoje Imie"'
  echo '  git config --global user.email "twoj-email@example.com"'
  exit 1
fi

echo "==> 1/5 Inicjalizacja repozytorium Git (gałąź: $BRANCH)..."
if [[ ! -d .git ]]; then
  git init -b "$BRANCH"
else
  git branch -M "$BRANCH"
fi

echo "==> 2/5 Dodawanie plików z poszanowaniem .gitignore..."
git add -A

echo "==> 3/5 Kontrola bezpieczeństwa rozmiaru plików (limit GitHub: 100 MB)..."
OVERSIZED=0
while IFS= read -r -d '' file; do
  if [[ -f "$file" ]]; then
    size=$(stat -c%s "$file")
    if (( size > 52428800 )); then
      echo "[UWAGA] Plik >50 MB wykryty w stagingu: $file ($((size / 1048576)) MB)"
      OVERSIZED=1
    fi
  fi
done < <(git diff --cached --name-only -z)

if (( OVERSIZED == 1 )); then
  echo "[BŁĄD] Wykryto pliki przekraczające 50 MB. Sprawdź .gitignore przed wypchnięciem na GitHub!"
  exit 1
fi

FILE_COUNT=$(git diff --cached --name-only | wc -l)
echo "    Gotowych do commita plików: $FILE_COUNT (brak plików >50 MB, Fizjolingo.zip i PDF wykluczone)."

echo "==> 4/5 Tworzenie commita..."
if git diff --cached --quiet; then
  echo "    Brak nowych zmian do zatwierdzenia — przechodzę do push."
else
  git commit -m "Initial commit: PhysioLingo v6 — 3D Functional & Clinical Anatomy PWA"
fi

echo "==> 5/5 Konfiguracja zdalnego repozytorium 'origin' i wypchnięcie na GitHub..."
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

if ! git push -u origin "$BRANCH"; then
  echo ""
  echo "[INFO] Push został odrzucony — najprawdopodobniej repozytorium na GitHub zawiera już początkowy commit (np. README lub LICENSE)."
  echo "Jeśli chcesz połączyć historię bez utraty plików ze zdalnego repo:"
  echo "  git pull origin $BRANCH --allow-unrelated-histories --no-rebase"
  echo "  git push -u origin $BRANCH"
  echo "Lub (jeśli zdalne repo ma tylko pusty szablon README i chcesz go nadpisać zawartością PhysioLingo):"
  echo "  git push -u origin $BRANCH --force-with-lease"
  exit 1
fi

echo ""
echo "[OK] Aplikacja PhysioLingo została pomyślnie wyeksportowana do: $REPO_URL (gałąź: $BRANCH)"
