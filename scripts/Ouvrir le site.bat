@echo off
chcp 65001 >nul
title Site Laurent Brizzi

rem Raccourci : double-cliquer ouvre le site dans le navigateur.
rem Ouvrir un fichier .html directement ne suffit pas : le navigateur
rem refuse alors de charger les couleurs et la mise en page.
rem
rem Ce fichier doit rester en CRLF et sans accents. Sinon cmd.exe le
rem decoupe en morceaux et tente de les executer un par un.

cd /d "%~dp0.."

where node >nul 2>&1
if errorlevel 1 goto pasdenode

echo.
echo   Le site s'ouvre dans votre navigateur.
echo.
echo   GARDEZ CETTE FENETRE OUVERTE tant que vous regardez le site.
echo   Pour arreter : fermez simplement cette fenetre.
echo.

node "scripts\serveur.mjs" --ouvrir
goto fin

:pasdenode
echo.
echo   Node.js est introuvable sur cet ordinateur.
echo   Il est necessaire pour afficher le site sur votre machine.
echo   A telecharger sur https://nodejs.org
echo.
pause

:fin
