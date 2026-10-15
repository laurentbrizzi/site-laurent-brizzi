@echo off
chcp 65001 >nul
title Dossier artistique - Laurent Brizzi

rem Raccourci : double-cliquer ouvre le dossier artistique dans le
rem navigateur, pret a etre imprime en PDF.
rem
rem Le dossier n'est relie a aucune page du site : c'est un document, pas
rem une etape de navigation. Sans ce raccourci il faudrait retenir une
rem adresse par coeur, et c'est exactement le genre de chose qu'on oublie.
rem
rem Ce fichier doit rester en CRLF et sans accents. Sinon cmd.exe le
rem decoupe en morceaux et tente de les executer un par un.

cd /d "%~dp0.."

where node >nul 2>&1
if errorlevel 1 goto pasdenode

echo.
echo   Le dossier artistique s'ouvre dans votre navigateur.
echo.
echo   Pour obtenir le PDF : bouton "Imprimer le dossier",
echo   puis choisir "Enregistrer au format PDF" comme destination.
echo.
echo   GARDEZ CETTE FENETRE OUVERTE pendant ce temps.
echo   Pour arreter : fermez simplement cette fenetre.
echo.

node "scripts\serveur.mjs" --ouvrir --page=dossier.html
goto fin

:pasdenode
echo.
echo   Node.js est introuvable sur cet ordinateur.
echo   Il est necessaire pour afficher le dossier sur votre machine.
echo   A telecharger sur https://nodejs.org
echo.
pause

:fin
