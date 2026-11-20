#!/bin/sh
# Send the latest commit on main to both GitHub repositories (run from Git Bash after committing):
#  - origin, Inspired-Education-Group/Edge-Preview (private): main as it is, with its full history;
#  - public, JPInspired/Edge-Academy (public): the same files as one new commit on top of its own history, signed
#    with the JPInspired account's GitHub no-reply address, so no personal email address appears in public.
# Optional: a message for the public commit (otherwise the last commit's message is used).
set -e
cd "$(dirname "$0")"
NAME="JPInspired"
MAIL="351588370+JPInspired@users.noreply.github.com"
git remote get-url public >/dev/null 2>&1 || git remote add public https://github.com/JPInspired/Edge-Academy.git
git push -q origin main
echo "private: pushed $(git rev-parse --short main)"
git fetch -q public 2>/dev/null || true
MSG=${1:-$(git log -1 --format=%B main)}
P=""
if git rev-parse -q --verify refs/remotes/public/main >/dev/null; then
  if [ "$(git rev-parse 'public/main^{tree}')" = "$(git rev-parse 'main^{tree}')" ]; then
    echo "public: already up to date"
    exit 0
  fi
  P="-p public/main"
fi
C=$(printf '%s\n' "$MSG" | GIT_AUTHOR_NAME="$NAME" GIT_AUTHOR_EMAIL="$MAIL" GIT_COMMITTER_NAME="$NAME" GIT_COMMITTER_EMAIL="$MAIL" git commit-tree 'main^{tree}' $P)
git push -q public "$C:refs/heads/main"
git fetch -q public
echo "public: pushed $(git rev-parse --short "$C")"
