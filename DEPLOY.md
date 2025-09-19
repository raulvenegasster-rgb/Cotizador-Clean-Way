# Despliegue en GitHub + Vercel (Vite + React)

## 1) GitHub
```bash
git init
git add .
git commit -m "feat(cleanway): primer release"
git branch -M main
git remote add origin <URL-DE-TU-REPO-EN-GITHUB>
git push -u origin main
```

## 2) Vercel
1. Crea una cuenta en https://vercel.com/ y conecta GitHub.
2. New Project → Importa tu repo `cleanway-quoting-engine`.
3. Framework: **Vite** (auto-detectado).
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Root Directory: raíz del repo (no /app ni /src).
7. Deploy.

El archivo `vercel.json` ya incluye el fallback de SPA para rutas.
