# Run this from PowerShell.
# This script assumes Git is installed and that your GitHub account has access to:
# https://github.com/NotedOISapp/NoteBox.git

cd "C:\Users\mskir\Desktop\NoteBox App Build"

git init
git branch -M main
git remote remove origin 2>$null
git remote add origin https://github.com/NotedOISapp/NoteBox.git

git status
git add README.md .gitignore .easignore .env.example docs/
git commit -m "Add NoteBox project docs"
git push -u origin main
